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
      />
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
import { defineComponent, ref, reactive, onBeforeMount, watch, nextTick } from 'vue'
import {
  walkFolders,
  windowsDrives,
  shortcutDirs,
  openFile,
  getEnvironment,
} from '../backend/utils.js'
import { useExplorerStore } from '../store/explorerStore.js'
import { createLatestRequestGuard, getFileSystemErrorMessage } from '../utils/fileExplorer.js'
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

    onBeforeMount(async () => {
      try {
        const [environment, shortcuts] = await Promise.all([getEnvironment(), shortcutDirs()])
        pathSeparator.value = environment.pathSeparator
        platform.value = environment.platform

        let initialFolder = pathSeparator.value

        if (platform.value === 'win32') {
          const localDrives = await windowsDrives()
          drives.splice(0, drives.length, ...localDrives)
          currentDrive.value = drives.find((drive) => drive.toLowerCase() === 'c:') ?? drives[0]
          initialFolder = currentDrive.value + pathSeparator.value
        }

        setSelectedFolder(initialFolder)
        const listing = await loadSelectedFolder(initialFolder)

        if (selectedFolder.value === initialFolder && listing?.error === void 0) {
          folderTree.splice(0, folderTree.length, ...getSideFolders(listing.entries))
        }

        shortcutLinks.push(
          { name: 'Home', path: shortcuts.home, icon: 'home' },
          { name: 'Desktop', path: shortcuts.desktop, icon: 'desktop_windows' },
          { name: 'Documents', path: shortcuts.document, icon: 'folder' },
          { name: 'Download', path: shortcuts.download, icon: 'vertical_align_bottom' },
          { name: 'Pictures', path: shortcuts.picture, icon: 'image' },
          { name: 'Audio', path: shortcuts.audio, icon: 'music_note' },
          { name: 'Video', path: shortcuts.video, icon: 'local_movies' },
        )
      } catch (error) {
        store.error = getFileSystemErrorMessage(error)
        store.loading = false
      }
    })

    // Windows has multiple filesystem roots, so switching drives resets the
    // side tree and content pane to the selected drive root.
    watch(currentDrive, async (drive) => {
      if (!drive) return

      const driveRoot = drive + pathSeparator.value
      if (selectedFolder.value === driveRoot) return

      setSelectedFolder(driveRoot)
      const listing = await loadSelectedFolder(driveRoot)

      if (selectedFolder.value === driveRoot && listing?.error === void 0) {
        folderTree.splice(0, folderTree.length, ...getSideFolders(listing.entries))
      }
    })

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
        } else {
          done(getSideFolders(listing.entries))
        }
      } catch {
        // QTree owns its lazy-loading indicator, so report failure through the
        // callback supplied by Quasar instead of mutating page-level state.
        fail()
      }
    }

    async function onShortcut({ path }) {
      await onSelectedFolder(path)
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

      // The directory request itself is guarded, and this companion check keeps
      // an older request from moving QTree selection after newer navigation.
      if (selectedFolder.value === targetPath) {
        await syncTreeSelection(targetPath)
      }
    }

    async function syncTreeSelection(absolutePath) {
      await nextTick()

      if (treeRef.value?.getNodeByKey(absolutePath)) {
        selectedKey.value = absolutePath
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
      selectedKey,
      onLazyLoad,
      onShortcut,
      onDblClicked,
      onSelectedFolder,
      toggleListType,
    }
  },
})
</script>
