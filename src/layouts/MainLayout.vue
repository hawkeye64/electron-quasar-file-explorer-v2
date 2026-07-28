<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />

        <breadcrumbs
          :absolute-path="selectedFolder"
          :path-separator="pathSeparator"
          :platform="platform"
          @selected="onSelectedFolder"
        />

        <q-btn
          flat
          dense
          round
          :icon="store.listType === 'grid' ? 'format_list_bulleted' : 'border_all'"
          :disable="store.viewType !== 'nodes'"
          aria-label="toggle between grid and list modes"
          @click="toggleListType"
        />
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above side="left" behavior="desktop" bordered>
      <q-item-label header> Shortcuts </q-item-label>

      <q-list dense>
        <shortcut-link
          v-for="shortcut in shortcutLinks"
          :key="shortcut.name"
          v-bind="shortcut"
          :active="isShortcutSelected(shortcut.path)"
          @shortcut="onShortcut"
        />
      </q-list>

      <q-separator />

      <q-select
        v-if="drives.length > 1"
        v-model="currentDrive"
        :options="drives"
        label="Drives"
        dense
        class="q-mx-lg q-mb-md"
        @update:model-value="onDriveSelected"
      />

      <q-separator v-if="drives.length > 1" />

      <q-item-label header> File System </q-item-label>

      <q-tree
        ref="treeRef"
        v-model:selected="selectedKey"
        label-key="name"
        node-key="path"
        :nodes="folderTree"
        dense
        accordion
        style="width: 100%"
        @lazy-load="onLazyLoad"
        @update:selected="onSelectedFolder"
      >
        <template #default-header="{ node }">
          <div :ref="(element) => setTreeNodeElement(node.path, element)">
            {{ node.name }}
          </div>
        </template>
      </q-tree>
    </q-drawer>

    <q-page-container>
      <q-page>
        <contents
          v-show="store.viewType === 'nodes'"
          :contents="store.files"
          :list-type="store.listType"
          :loading="store.loading"
          :error="store.error"
          :warning-count="store.warningCount"
          @dblclick="onDblClicked"
        />
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script>
import ShortcutLink from '@/components/ShortcutLink.vue'
import Breadcrumbs from '@/components/Breadcrumbs.vue'
import { defineComponent, ref, reactive, onBeforeMount, nextTick } from 'vue'
import {
  walkFolders,
  windowsDrives,
  shortcutDirs,
  openFile,
  getEnvironment,
} from '../backend/utils.js'
import { useExplorerStore } from '../store/explorerStore.js'
import {
  areFileSystemPathsEqual,
  createLatestRequestGuard,
  getFileSystemRoot,
  getFileSystemErrorMessage,
  getShortcutLinks,
  getTreePathKeys,
} from '../utils/fileExplorer.js'
import Contents from '../components/Contents.vue'

export default defineComponent({
  name: 'MainLayout',

  components: {
    ShortcutLink,
    Breadcrumbs,
    Contents,
  },

  setup() {
    const treeRef = ref(null),
      leftDrawerOpen = ref(false),
      folderTree = reactive([]),
      shortcutLinks = reactive([]),
      store = useExplorerStore(),
      selectedFolder = ref(''),
      currentDrive = ref(),
      selectedKey = ref(null),
      drives = reactive([]),
      pathSeparator = ref(''),
      platform = ref('')

    // Directory reads happen in Electron's main process and may finish in a
    // different order than they started. This guard prevents an older, slower
    // read from replacing the folder the user selected most recently.
    const navigationRequests = createLatestRequestGuard()

    // Tree navigation has its own lifecycle: revealing a shortcut may need to
    // change roots and lazy-load several ancestors before QTree can select it.
    const treeRevealRequests = createLatestRequestGuard(),
      loadedTreeNodes = new Set(),
      treeLoadStates = new Map(),
      treeNodeElements = new Map()
    let treeRootPath = ''

    onBeforeMount(async () => {
      try {
        const [environment, shortcuts] = await Promise.all([getEnvironment(), shortcutDirs()])
        pathSeparator.value = environment.pathSeparator
        platform.value = environment.platform

        // Electron resolves the correct per-user home directory on every
        // supported OS. It is a more useful and familiar startup location than
        // exposing the filesystem root or Windows system drive by default.
        const initialFolder = shortcuts.home

        if (platform.value === 'win32') {
          const localDrives = await windowsDrives()
          drives.splice(0, drives.length, ...localDrives)
          const homeDrive = initialFolder.slice(0, 2).toUpperCase()
          currentDrive.value =
            drives.find((drive) => drive === homeDrive) ??
            drives.find((drive) => drive.toLowerCase() === 'c:') ??
            drives[0]
        }

        setSelectedFolder(initialFolder)
        shortcutLinks.push(...getShortcutLinks(shortcuts, platform.value))

        // The content pane opens at home, while the tree keeps its natural
        // filesystem root and expands down to home just like a native explorer.
        await Promise.all([loadSelectedFolder(initialFolder), revealTreePath(initialFolder)])
      } catch (error) {
        store.error = getFileSystemErrorMessage(error)
        store.loading = false
      }
    })

    // This handler runs only when the user changes QSelect. Updating
    // currentDrive programmatically while navigating must not redirect a
    // Windows home/shortcut path back to its drive root.
    async function onDriveSelected(drive) {
      if (!drive) return

      const driveRoot = drive + pathSeparator.value
      if (selectedFolder.value === driveRoot) return

      setSelectedFolder(driveRoot)
      await loadSelectedFolder(driveRoot)

      if (selectedFolder.value === driveRoot) {
        await revealTreePath(driveRoot)
      }
    }

    function sortContents(entries) {
      return [...entries].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      )
    }

    function applyDirectoryListing(listing) {
      const entries = sortContents(listing.entries)
      store.files.splice(0, store.files.length, ...entries)
      store.warningCount = listing.errors.length
      store.error = listing.error ? getFileSystemErrorMessage(listing.error) : ''
    }

    function getSideFolders(entries) {
      return sortContents(entries)
        .filter((entry) => entry.isDir)
        .map((entry) => ({
          ...entry,
          lazy: true,
          tickable: true,
        }))
    }

    async function loadSelectedFolder(absolutePath) {
      const navigationId = navigationRequests.begin()
      store.loading = true
      store.error = ''
      store.warningCount = 0

      try {
        const listing = await walkFolders(absolutePath)

        if (navigationRequests.isLatest(navigationId)) {
          applyDirectoryListing(listing)
        }

        return listing
      } catch {
        if (navigationRequests.isLatest(navigationId)) {
          store.files.splice(0, store.files.length)
          store.error = `Unable to read “${absolutePath}”.`
        }

        return null
      } finally {
        if (navigationRequests.isLatest(navigationId)) {
          store.loading = false
        }
      }
    }

    async function onLazyLoad({ key, done, fail }) {
      // QTree lazy loading is separate from the active content-pane request:
      // expanding a tree branch should not change the current folder.
      try {
        const listing = await walkFolders(key)

        if (listing.error) {
          fail()
          finishTreeLoad(key, false)
        } else {
          done(getSideFolders(listing.entries))
          loadedTreeNodes.add(key)

          // QTree updates its internal lazy/expanded metadata on nextTick after
          // done(). Resolve programmatic expansion only when that state is ready.
          await nextTick()
          finishTreeLoad(key, true)
        }
      } catch {
        // QTree owns its lazy-loading indicator, so report failure through the
        // callback supplied by Quasar instead of mutating page-level state.
        fail()
        finishTreeLoad(key, false)
      }
    }

    function finishTreeLoad(key, succeeded) {
      const state = treeLoadStates.get(key)
      if (state) {
        treeLoadStates.delete(key)
        state.resolve(succeeded)
      }
    }

    function waitForTreeNodeLoad(key) {
      if (loadedTreeNodes.has(key)) {
        treeRef.value.setExpanded(key, true)
        return Promise.resolve(true)
      }

      const existingState = treeLoadStates.get(key)
      if (existingState) {
        return existingState.promise
      }

      let resolveLoad
      const promise = new Promise((resolve) => {
        resolveLoad = resolve
      })

      treeLoadStates.set(key, {
        promise,
        resolve: resolveLoad,
      })
      treeRef.value.setExpanded(key, true)

      return promise
    }

    async function loadTreeRoot(rootPath, revealId) {
      if (treeRootPath === rootPath) return true

      const listing = await walkFolders(rootPath)
      if (treeRevealRequests.isLatest(revealId) !== true || listing.error !== void 0) {
        return false
      }

      // Resolve any obsolete waits before replacing the node graph. Lazy-load
      // callbacks from the old root may still finish, but no longer affect the
      // visible tree.
      for (const state of treeLoadStates.values()) {
        state.resolve(false)
      }
      treeLoadStates.clear()
      loadedTreeNodes.clear()
      treeNodeElements.clear()
      selectedKey.value = null
      treeRootPath = rootPath
      folderTree.splice(0, folderTree.length, ...getSideFolders(listing.entries))
      await nextTick()

      return true
    }

    async function revealTreePath(absolutePath) {
      const revealId = treeRevealRequests.begin()
      const rootPath = getFileSystemRoot(absolutePath, pathSeparator.value, platform.value)

      if ((await loadTreeRoot(rootPath, revealId)) !== true || !treeRef.value) {
        return
      }

      const pathKeys = getTreePathKeys(absolutePath, rootPath, pathSeparator.value)

      // Expand one level at a time. Each lazy-load completion makes the next
      // path segment available through QTree's public getNodeByKey() API.
      for (const key of pathKeys) {
        if (
          treeRevealRequests.isLatest(revealId) !== true ||
          treeRef.value.getNodeByKey(key) === void 0 ||
          (await waitForTreeNodeLoad(key)) !== true
        ) {
          return
        }
      }

      if (
        treeRevealRequests.isLatest(revealId) !== true ||
        treeRef.value.getNodeByKey(absolutePath) === void 0
      ) {
        return
      }

      selectedKey.value = absolutePath
      await nextTick()
      treeNodeElements.get(absolutePath)?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      })
    }

    function setTreeNodeElement(key, element) {
      if (element) {
        treeNodeElements.set(key, element)
      } else {
        treeNodeElements.delete(key)
      }
    }

    async function onShortcut({ path }) {
      await onSelectedFolder(path)
    }

    function isShortcutSelected(path) {
      return areFileSystemPathsEqual(selectedFolder.value, path, platform.value)
    }

    async function onDblClicked(node) {
      if (node.isDir) {
        await onSelectedFolder(node.path)
      } else {
        await onFileSelected(node)
      }
    }

    function setSelectedFolder(absolutePath) {
      selectedFolder.value = absolutePath
      store.viewType = 'nodes'

      if (platform.value === 'win32') {
        if (selectedFolder.value.charAt(1) === ':') {
          selectedFolder.value =
            selectedFolder.value.charAt(0).toUpperCase() + selectedFolder.value.slice(1)
        }
        if (selectedFolder.value.charAt(absolutePath.length - 1) === ':') {
          selectedFolder.value += pathSeparator.value
        }
        if (selectedFolder.value.charAt(1) === ':') {
          currentDrive.value = selectedFolder.value.slice(0, 2).toUpperCase()
        }
      }
    }

    async function onSelectedFolder(absolutePath) {
      if (typeof absolutePath !== 'string' || absolutePath.length === 0) return

      setSelectedFolder(absolutePath)
      const targetPath = selectedFolder.value
      await loadSelectedFolder(targetPath)

      // The directory request itself is guarded; tree revealing has a separate
      // guard because it may require several lazy IPC reads.
      if (selectedFolder.value === targetPath) {
        await revealTreePath(targetPath)
      }
    }

    async function onFileSelected(node) {
      try {
        const errorMessage = await openFile(node.path)
        if (errorMessage) {
          store.error = errorMessage
        }
      } catch {
        store.error = `Unable to open “${node.path}”.`
      }
    }

    function toggleListType() {
      store.listType = store.listType === 'grid' ? 'list' : 'grid'
    }

    return {
      store,
      treeRef,
      leftDrawerOpen,
      toggleLeftDrawer() {
        leftDrawerOpen.value = !leftDrawerOpen.value
      },
      shortcutLinks,
      folderTree,
      selectedFolder,
      pathSeparator,
      platform,
      currentDrive,
      drives,
      onDriveSelected,
      selectedKey,
      setTreeNodeElement,
      onLazyLoad,
      onShortcut,
      isShortcutSelected,
      onDblClicked,
      onSelectedFolder,
      toggleListType,
    }
  },
})
</script>
