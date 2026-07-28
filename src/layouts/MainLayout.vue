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
          :icon="store.listType === 'grid' ? 'view_list' : 'grid_view'"
          :disable="store.viewType !== 'nodes'"
          :aria-label="store.listType === 'grid' ? 'Switch to list view' : 'Switch to grid view'"
          @click="toggleListType"
        />

        <explorer-menu
          ref="menuRef"
          :platform="platform"
          :current-path="selectedFolder"
          :show-hidden-files="store.showHiddenFiles"
          :can-decrease-icon-size="canDecreaseIconSize"
          :can-increase-icon-size="canIncreaseIconSize"
          @new-window="createNewWindow"
          @decrease-icon-size="changeIconSize(-1)"
          @increase-icon-size="changeIconSize(1)"
          @set-view="setContentView"
          @toggle-hidden-files="toggleHiddenFiles"
          @open-path="openEnteredPath"
          @parent="navigateToParentFolder"
          @refresh="refreshSelectedFolder"
        />
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above side="left" behavior="desktop" bordered>
      <!--
        The two navigation surfaces scroll independently. Expanding a deep tree
        path must not push native-location shortcuts out of reach, and a short
        window must still allow every shortcut to be reached.
      -->
      <div class="drawer-navigation column no-wrap">
        <section class="drawer-pane drawer-pane--shortcuts column no-wrap">
          <q-item-label id="shortcut-heading" header> Shortcuts </q-item-label>

          <q-list dense class="drawer-pane__scroll" aria-labelledby="shortcut-heading">
            <shortcut-link
              v-for="shortcut in shortcutLinks"
              :key="shortcut.name"
              v-bind="shortcut"
              :active="isShortcutSelected(shortcut.path)"
              @shortcut="onShortcut"
            />
          </q-list>
        </section>

        <q-separator />

        <section class="drawer-pane drawer-pane--filesystem column no-wrap">
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

          <q-item-label id="filesystem-heading" header> File System </q-item-label>

          <div class="drawer-pane__scroll">
            <q-tree
              ref="treeRef"
              v-model:selected="selectedKey"
              label-key="name"
              node-key="path"
              :nodes="folderTree"
              dense
              accordion
              style="width: 100%"
              aria-labelledby="filesystem-heading"
              @lazy-load="onLazyLoad"
              @update:selected="onSelectedFolder"
            >
              <template #default-header="{ node }">
                <div :ref="(element) => setTreeNodeElement(node.path, element)">
                  {{ node.name }}
                </div>
              </template>
            </q-tree>
          </div>
        </section>
      </div>
    </q-drawer>

    <q-page-container>
      <q-page>
        <contents
          v-show="store.viewType === 'nodes'"
          :contents="visibleFiles"
          :list-type="store.listType"
          :grid-icon-size="store.gridIconSize"
          :loading="store.loading"
          :error="store.error"
          :warning-count="store.warningCount"
          @dblclick="onDblClicked"
        />
      </q-page>
    </q-page-container>

    <q-dialog v-model="locationErrorDialogOpen">
      <q-card class="location-error-dialog">
        <q-card-section>
          <div class="text-h6">Oops! Something went wrong.</div>
          <p class="q-mb-none q-mt-sm">{{ locationErrorMessage }}</p>
        </q-card-section>

        <q-separator />

        <q-card-actions align="right">
          <q-btn v-close-popup autofocus flat color="primary" label="OK" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script>
import ShortcutLink from '@/components/ShortcutLink.vue'
import Breadcrumbs from '@/components/Breadcrumbs.vue'
import ExplorerMenu from '@/components/ExplorerMenu.vue'
import {
  computed,
  defineComponent,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue'
import {
  walkFolders,
  windowsDrives,
  shortcutDirs,
  openFile,
  openNewWindow,
  getEnvironment,
} from '../backend/utils.js'
import { gridIconSizes, useExplorerStore } from '../store/explorerStore.js'
import {
  areFileSystemPathsEqual,
  createLatestRequestGuard,
  getEnteredPathErrorMessage,
  getExplorerKeyboardAction,
  getExplorerWheelDirection,
  getFileSystemRoot,
  getFileSystemErrorMessage,
  getParentFileSystemPath,
  getShortcutLinks,
  getTreePathKeys,
  isFileSystemEntryVisible,
} from '../utils/fileExplorer.js'
import Contents from '../components/Contents.vue'

export default defineComponent({
  name: 'MainLayout',

  components: {
    ShortcutLink,
    Breadcrumbs,
    ExplorerMenu,
    Contents,
  },

  setup() {
    const treeRef = ref(null),
      menuRef = ref(null),
      leftDrawerOpen = ref(false),
      folderTree = reactive([]),
      shortcutLinks = reactive([]),
      store = useExplorerStore(),
      selectedFolder = ref(''),
      currentDrive = ref(),
      selectedKey = ref(null),
      drives = reactive([]),
      pathSeparator = ref(''),
      platform = ref(''),
      locationErrorDialogOpen = ref(false),
      locationErrorMessage = ref('')

    const visibleFiles = computed(() =>
        store.files.filter((entry) => isFileSystemEntryVisible(entry, store.showHiddenFiles)),
      ),
      canDecreaseIconSize = computed(() => gridIconSizes.indexOf(store.gridIconSize) > 0),
      canIncreaseIconSize = computed(
        () => gridIconSizes.indexOf(store.gridIconSize) < gridIconSizes.length - 1,
      )

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
    const wheelListenerOptions = { passive: false }
    let treeRootPath = '',
      lastIconWheelAdjustment = 0

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

    onMounted(() => {
      window.addEventListener('keydown', onApplicationKeydown)
      window.addEventListener('wheel', onApplicationWheel, wheelListenerOptions)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', onApplicationKeydown)
      window.removeEventListener('wheel', onApplicationWheel, wheelListenerOptions)
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
        .filter((entry) => entry.isDir && isFileSystemEntryVisible(entry, store.showHiddenFiles))
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

    async function openEnteredPath(absolutePath) {
      const navigationId = navigationRequests.begin()
      let opened = false
      store.loading = true

      try {
        const listing = await walkFolders(absolutePath)

        if (navigationRequests.isLatest(navigationId) !== true) {
          return
        }

        if (listing.error) {
          locationErrorMessage.value = getEnteredPathErrorMessage(absolutePath, listing.error)
          locationErrorDialogOpen.value = true
        } else {
          // Unlike tree and shortcut navigation, a typed path is untrusted user
          // input. Commit it to the UI only after Electron confirms that the
          // folder can be read, so a typo cannot replace the current location.
          setSelectedFolder(absolutePath)
          applyDirectoryListing(listing)
          opened = true
        }
      } catch (error) {
        if (navigationRequests.isLatest(navigationId)) {
          locationErrorMessage.value = getEnteredPathErrorMessage(absolutePath, error)
          locationErrorDialogOpen.value = true
        }
      } finally {
        if (navigationRequests.isLatest(navigationId)) {
          store.loading = false
        }
      }

      if (opened) {
        await revealTreePath(absolutePath)
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

    async function createNewWindow() {
      try {
        await openNewWindow()
      } catch {
        store.error = 'Unable to open a new File Explorer window.'
      }
    }

    function setContentView(view) {
      if (view === 'grid' || view === 'list') {
        store.listType = view
      }
    }

    function changeIconSize(direction) {
      const currentIndex = gridIconSizes.indexOf(store.gridIconSize)
      const nextIndex = Math.min(gridIconSizes.length - 1, Math.max(0, currentIndex + direction))
      store.gridIconSize = gridIconSizes[nextIndex]
    }

    async function reloadTreePath(absolutePath) {
      // Force the tree to rebuild from its platform root. This is necessary
      // when visibility changes because previously lazy-loaded child arrays
      // contain the old hidden-file filter.
      treeRootPath = ''
      await revealTreePath(absolutePath)
    }

    async function toggleHiddenFiles() {
      store.showHiddenFiles = !store.showHiddenFiles
      await reloadTreePath(selectedFolder.value)
    }

    async function refreshSelectedFolder() {
      const targetPath = selectedFolder.value
      await loadSelectedFolder(targetPath)

      if (selectedFolder.value === targetPath) {
        await reloadTreePath(targetPath)
      }
    }

    async function navigateToParentFolder() {
      const parentPath = getParentFileSystemPath(
        selectedFolder.value,
        pathSeparator.value,
        platform.value,
      )

      if (parentPath !== selectedFolder.value) {
        await onSelectedFolder(parentPath)
      }
    }

    function onApplicationKeydown(event) {
      if (event.defaultPrevented || event.isComposing) return

      const actionName = getExplorerKeyboardAction(event, platform.value)
      if (!actionName) return

      event.preventDefault()
      const actions = {
        newWindow: () => {
          if (event.repeat !== true) void createNewWindow()
        },
        toggleHiddenFiles: () => void toggleHiddenFiles(),
        openLocation: () => menuRef.value?.openLocationDialog(),
        refresh: () => void refreshSelectedFolder(),
        gridView: () => setContentView('grid'),
        listView: () => setContentView('list'),
        increaseIconSize: () => changeIconSize(1),
        decreaseIconSize: () => changeIconSize(-1),
        parentFolder: () => void navigateToParentFolder(),
      }
      actions[actionName]()
    }

    function onApplicationWheel(event) {
      const direction = getExplorerWheelDirection(event, platform.value)
      if (direction === 0) return

      // The listener must be non-passive so the app can replace Chromium page
      // zoom with explorer icon sizing. A short interval turns high-frequency
      // touchpad gestures into deliberate one-level adjustments.
      event.preventDefault()
      const now = performance.now()
      if (now - lastIconWheelAdjustment < 120) return

      lastIconWheelAdjustment = now
      changeIconSize(direction)
    }

    function toggleListType() {
      store.listType = store.listType === 'grid' ? 'list' : 'grid'
    }

    return {
      store,
      treeRef,
      menuRef,
      locationErrorDialogOpen,
      locationErrorMessage,
      leftDrawerOpen,
      toggleLeftDrawer() {
        leftDrawerOpen.value = !leftDrawerOpen.value
      },
      shortcutLinks,
      folderTree,
      visibleFiles,
      canDecreaseIconSize,
      canIncreaseIconSize,
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
      openEnteredPath,
      createNewWindow,
      changeIconSize,
      setContentView,
      toggleHiddenFiles,
      refreshSelectedFolder,
      navigateToParentFolder,
      toggleListType,
    }
  },
})
</script>

<style scoped>
/*
 * The drawer itself must not scroll: each navigation pane owns its overflow.
 * min-height: 0 is essential in a flex column because it permits the panes to
 * shrink below their content height and activate their own scroll containers.
 */
.drawer-navigation {
  height: 100%;
  overflow: hidden;
}

.drawer-pane {
  min-height: 0;
}

.drawer-pane--shortcuts {
  flex: 0 1 auto;
  max-height: 50%;
}

.drawer-pane--filesystem {
  flex: 1 1 0;
}

.drawer-pane__scroll {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.drawer-pane--shortcuts .drawer-pane__scroll,
.drawer-pane--filesystem .drawer-pane__scroll {
  flex: 1 1 auto;
}

.location-error-dialog {
  width: min(420px, calc(100vw - 32px));
}
</style>
