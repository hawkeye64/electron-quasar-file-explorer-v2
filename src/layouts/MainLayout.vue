<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <breadcrumbs
          :absolute-path="selectedFolder"
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

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      side="left"
      behavior="desktop"
      bordered
    >
      <q-item-label
        header
      >
        Shortcuts
      </q-item-label>

      <q-list dense>
        <ShortcutLink
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

      <q-separator
        v-if="drives.length > 1"
      />

      <q-item-label
        header
      >
        File System
      </q-item-label>

      <q-tree
        ref="treeRef"
        v-model:selected="selectedKey"
        label-key="name"
        node-key="path"
        :nodes="folderTree"
        dense
        accordion
        default-expand-all
        style="width: 100%;"
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
          :view-type="store.viewType"
          @click="onClicked"
          @dblClick="onDblClicked"
        />
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script>
import ShortcutLink from 'components/ShortcutLink'
import Breadcrumbs from 'components/Breadcrumbs'
import { defineComponent, ref, reactive, onBeforeMount, watch, nextTick } from 'vue'
import {
  walkFolders,
  windowsDrives,
  shortcutDirs,
  openFile,
  getSep,
  getPlatform
} from '../backend/utils.js'
import { useExplorerStore } from '../store/explorerStore.js'
import Contents from '../pages/Contents.vue'
import mime from 'mime'

export default defineComponent({
  name: 'MainLayout',

  components: {
    ShortcutLink,
    Breadcrumbs,
    Contents
  },

  setup () {
    const
      treeRef = ref(null),
      leftDrawerOpen = ref(false),
      folderTree = reactive([]),
      shortcutLinks = reactive([]),
      store = useExplorerStore(),
      selectedFolder = ref(''),
      currentDrive = ref(),
      selectedKey = reactive([]),
      lazyLoading = ref(false),
      drives = reactive([])
    let pathSep = '',
      platform = ''

    onBeforeMount(async () => {
      // get path separator for this system
      pathSep = await getSep()
      // get system platform
      platform = await getPlatform()

      if (platform === 'win32') {
        const localDrives = await windowsDrives()
        drives.splice(0, drives.length, ...localDrives)
        currentDrive.value = drives.includes('c:') ? 'c:' : drives[ 0 ]
        selectedFolder.value = currentDrive.value + pathSep
      }
      else {
        // root folder (POSIX)
        selectedFolder.value = pathSep
      }

      // get root folders
      const folders = await adjustFolders(await walkFolders(selectedFolder.value))
      folderTree.splice(0, folderTree.length, ...folders)

      const shortcuts = await shortcutDirs()

      shortcutLinks.push({
        name: 'Home',
        path: shortcuts.home,
        icon: 'home'
      })

      shortcutLinks.push({
        name: 'Desktop',
        path: shortcuts.desktop,
        icon: 'desktop_windows'
      })

      shortcutLinks.push({
        name: 'Documents',
        path: shortcuts.document,
        icon: 'folder'
      })

      shortcutLinks.push({
        name: 'Download',
        path: shortcuts.download,
        icon: 'vertical_align_bottom'
      })

      shortcutLinks.push({
        name: 'Pictures',
        path: shortcuts.picture,
        icon: 'image'
      })

      shortcutLinks.push({
        name: 'Audio',
        path: shortcuts.audio,
        icon: 'music_note'
      })

      shortcutLinks.push({
        name: 'Video',
        path: shortcuts.video,
        icon: 'local_movies'
      })
    })

    // if the currentDrive changes,
    // then rescan the root folders of that drive
    // applicable for Windows only
    watch(currentDrive, async () => {
      selectedFolder.value = currentDrive.value + pathSep
      const folders = await adjustFolders(await walkFolders(selectedFolder.value))
      folderTree.splice(0, folderTree.length, ...folders)
    })

    function sortContents (folders) {
      // sort the data
      folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    }

    async function filterContents (folders, sort = true) {
      // add metadata and mimetype
      const filteredContent = await Promise.all(folders
        .filter(folder => !folder.error)
        .map(async folder => {
          // folder.metadata = await getMetadata(absolutePath)
          folder.mimetype = mime.getType(folder.path)
          return folder
        }))

      // sort contents
      sortContents(filteredContent)

      // add filtered content to store
      if (filteredContent && filteredContent.length > 0) {
        store.files.splice(0, store.files.length, ...filteredContent)
      }
      else {
        store.files.splice(0, store.files.length)
      }

      return filteredContent
    }

    async function filterSideFolders (folders, sort = true) {
      // filter folders
      const filteredFolders = await Promise.all(folders.filter(folder => folder.children !== undefined)
        // make folders with children lazy-loaded
        .map(async folder => {
          const absolutePath = folder.path + pathSep + folder.name
          folder.lazy = !!folder.children
          folder.tickable = true
          // folder.metadata = await getMetadata(absolutePath)
          folder.mimetype = mime.getType(absolutePath)
          return folder
        }))
      sortContents(filteredFolders)
      return filteredFolders
    }

    async function adjustFolders (folders) {
      await filterContents(folders)
      return await filterSideFolders(folders, false)
    }

    async function onLazyLoad ({ node, key, done, fail }) {
      lazyLoading.value = true
      try {
        setSelectedFolder(node.path)
        const folders = await adjustFolders(await walkFolders(key))
        done(folders)
      }
      catch (error) {
        console.error('Failed to fetch folders:', error)
        // fail()
        done([])
      }
      lazyLoading.value = false
    }

    async function onShortcut ({ name, path }) {
      setSelectedFolder(path)
      await filterContents(await walkFolders(path))
      expandTree(path)
    }

    watch(selectedFolder, (absolutePath) => {
      if (selectedFolder.value !== absolutePath) {
        onSelectedFolder(absolutePath)
      }
    })

    function onClicked (node) {
      // on single-clicks we don't do anything here
      // if we wanted to drill-down into folders, we
      // can call onDblClicked function.
    }

    async function onDblClicked (node) {
      // This causes a drill-down if it's a folder
      if (node.isDir) {
        store.viewType = 'nodes'
        await onSelectedFolder(node.path)
        expandTree(node.path)
      }
      else {
        onFileSelected(node)
      }
    }

    function setSelectedFolder (absolutePath) {
      selectedFolder.value = absolutePath
      store.viewType = 'nodes'
      // handle windows drive
      if (platform === 'win32') {
        if (selectedFolder.value.charAt(absolutePath.length - 1) === ':') {
          selectedFolder.value += pathSep
        }
        if (selectedFolder.value.charAt(1) === ':') {
          currentDrive.value = selectedFolder.value.charAt(0) + ':'
        }
      }
    }

    async function onSelectedFolder (absolutePath) {
      store.viewType = 'nodes'
      setSelectedFolder(absolutePath)
      await filterContents(await walkFolders(absolutePath))
      // in case this came from breadcrumbs component
      expandTree(absolutePath)
    }

    function onFileSelected (node) {
      openFile(node.path)
    }

    function expandTree (absolutePath) {
      if (!absolutePath) return

      // get parts for the path
      const parts = absolutePath.split(pathSep)
      let path2 = ''
      let lastNodeKey

      // iterate through the path parts.
      // This code will get the node. If the node is not found,
      // it forces lazy-load by programmatically expanding
      // the parent node.
      for (let index = 0; index < parts.length; ++index) {
        if (parts[ index ].length === 0) {
          continue
        }
        if (index === 0) {
          path2 += parts[ index ] + pathSep
        }
        else {
          if (path2[ path2.length - 1 ] !== pathSep) {
            path2 += pathSep
          }
          path2 += parts[ index ]
        }
        if (index > -1) {
          if (treeRef.value) {
            const key = treeRef.value.getNodeByKey(path2)
            // if we get key, then this folder has already been loaded
            if (key) {
              lastNodeKey = key
            }
            // handle folder not expanded
            if (lastNodeKey && !treeRef.value.isExpanded(lastNodeKey.path)) {
              treeRef.value.setExpanded(lastNodeKey.path, true)
              if (path2 === absolutePath) {
                // selected = absolutePath
              }
              else {
                nextTick(() => {
                  const interval = setInterval(() => {
                    if (lazyLoading.value === false) {
                      clearInterval(interval)
                      expandTree(absolutePath)
                    }
                  }, 50)
                })
              }
            }
          }
        }
      }
    }

    function toggleListType () {
      if (store.listType === 'grid') {
        store.listType = 'list'
      }
      else {
        store.listType = 'grid'
      }
    }

    return {
      store,
      treeRef,
      leftDrawerOpen,
      toggleLeftDrawer () {
        leftDrawerOpen.value = !leftDrawerOpen.value
      },
      shortcutLinks,
      folderTree,
      selectedFolder,
      currentDrive,
      drives,
      selectedKey,
      onLazyLoad,
      onShortcut,
      onClicked,
      onDblClicked,
      onSelectedFolder,
      toggleListType
    }
  }
})
</script>
