<template>
  <div class="contents-container">
    <q-banner v-if="error" class="bg-negative text-white" role="alert">
      {{ error }}
    </q-banner>

    <q-banner v-else-if="warningCount > 0" class="bg-warning text-dark" role="status">
      {{ warningCount }} {{ warningCount === 1 ? 'entry was' : 'entries were' }} skipped because
      they could not be read.
    </q-banner>

    <div v-if="!loading && !error && contents.length === 0" class="empty-folder" role="status">
      This folder is empty.
    </div>

    <div v-else-if="!error" class="contents-wrapper">
      <div v-if="listType === 'grid'" class="row justify-left" aria-label="Folder contents">
        <template v-for="node in contents" :key="node.path">
          <grid-item
            :node="node"
            :selected-node="selectedNode"
            :size="gridIconSize"
            class="non-selectable"
            @click="onClick"
            @dblclick="onDblClick"
            @contextmenu.prevent="onContextMenu(node)"
          />
        </template>
      </div>

      <div v-if="listType === 'list'" id="content-scroll" style="min-height: 100%">
        <!--
          Quasar's virtual scroll keeps the DOM bounded even when a folder
          contains thousands of entries. The complete row array remains
          available for sorting, but only visible rows are rendered.
        -->
        <q-table
          id="content"
          v-model:pagination="pagination"
          dense
          hide-bottom
          flat
          virtual-scroll
          :virtual-scroll-item-size="32"
          :rows="contents"
          :columns="columns"
          row-key="path"
          separator="none"
          class="no-border-radius my-sticky-header-table"
          style="min-height: 100%"
        >
          <template #body="props">
            <q-tr
              :id="props.row.path"
              :props="props"
              :style="selectedStyleObject(props.row)"
              class="non-selectable cursor-pointer"
              tabindex="0"
              :aria-label="`${props.row.isDir ? 'Folder' : 'File'} ${props.row.name}`"
              @click.stop="rowClick(props.row)"
              @dblclick.stop="dblRowClick(props.row)"
              @keydown.enter.prevent="dblRowClick(props.row)"
              @keydown.space.prevent="rowClick(props.row)"
              @contextmenu.prevent="onContextMenu(props.row)"
            >
              <q-td key="type" :props="props" :style="'width: ' + imageWidth + 'px;'">
                <grid-item-image :key="props.row.path" :node="props.row" :width="imageWidth" />
              </q-td>
              <q-td key="label" :props="props" class="file-name-cell">
                <span class="file-name" :title="props.row.name">
                  <span class="file-name-start">{{ getFileNameParts(props.row.name).start }}</span
                  ><span class="file-name-end">{{ getFileNameParts(props.row.name).end }}</span>
                </span>
              </q-td>
              <q-td key="size" :props="props">
                {{ getSize(props.row) }}
              </q-td>
              <q-td key="modified" :props="props">
                {{ getModified(props.row) }}
              </q-td>
            </q-tr>
          </template>
        </q-table>
      </div>
    </div>

    <q-inner-loading :showing="loading" label="Loading folder…" />

    <q-menu context-menu touch-position>
      <q-list dense style="min-width: 180px">
        <q-item v-close-popup clickable :disable="!selectedNode" @click="$emit('copy')">
          <q-item-section avatar><q-icon name="content_copy" /></q-item-section>
          <q-item-section>Copy</q-item-section>
          <q-item-section side>Ctrl/Cmd+C</q-item-section>
        </q-item>
        <q-item v-close-popup clickable :disable="!selectedNode" @click="$emit('cut')">
          <q-item-section avatar><q-icon name="content_cut" /></q-item-section>
          <q-item-section>Cut</q-item-section>
          <q-item-section side>Ctrl/Cmd+X</q-item-section>
        </q-item>
        <q-item v-close-popup clickable :disable="!clipboardAvailable" @click="$emit('paste')">
          <q-item-section avatar><q-icon name="content_paste" /></q-item-section>
          <q-item-section>Paste</q-item-section>
          <q-item-section side>Ctrl/Cmd+V</q-item-section>
        </q-item>
        <q-separator />
        <q-item v-close-popup clickable :disable="!selectedNode" @click="$emit('properties')">
          <q-item-section avatar><q-icon name="info" /></q-item-section>
          <q-item-section>Properties</q-item-section>
        </q-item>
        <q-item v-close-popup clickable :disable="!selectedNode" @click="$emit('trash')">
          <q-item-section avatar><q-icon name="delete" /></q-item-section>
          <q-item-section>Move to Trash</q-item-section>
          <q-item-section side>Delete</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </div>
</template>

<script>
import { defineComponent, reactive, ref, watch } from 'vue'
import { date } from 'quasar'
import prettyBytes from 'pretty-bytes'
import GridItem from './GridItem.vue'
import GridItemImage from './GridItemImage.vue'
import { getFileNameDisplayParts, isValidTimestamp } from '../utils/fileExplorer.js'

export default defineComponent({
  name: 'Contents',

  components: {
    GridItem,
    GridItemImage,
  },

  props: {
    contents: {
      type: Array,
      default: () => [],
    },
    listType: {
      type: String,
      required: true,
    },
    gridIconSize: {
      type: Number,
      required: true,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    error: {
      type: String,
      default: '',
    },
    warningCount: {
      type: Number,
      default: 0,
    },
    clipboardAvailable: Boolean,
  },

  emits: ['dblclick', 'select', 'copy', 'cut', 'paste', 'properties', 'trash'],

  setup(props, { emit }) {
    const selectedNode = ref(null),
      imageWidth = 25,
      columns = reactive([
        {
          name: 'type',
          required: true,
          label: 'Type',
          field: (row) => row.mimetype || (row.isDir ? 'inode/directory' : ''),
          align: 'center',
          sortable: false,
          style: 'max-width: 50px;',
          headerStyle: 'max-width: 50px;',
        },
        {
          name: 'label',
          required: true,
          label: 'Name',
          field: 'name',
          align: 'left',
          sortable: true,
          style: 'width: 100%',
          headerStyle: 'width: 100%',
        },
        {
          name: 'size',
          label: 'Size',
          field: (row) => row.metadata?.size || 0,
          format: (_value, row) => getSize(row),
          align: 'right',
          sortable: true,
          style: 'max-width: 80px; min-width: 80px;',
          headerStyle: 'max-width: 80px; min-width: 80px;',
        },
        {
          name: 'modified',
          label: 'Modified',
          field: (row) => row.metadata?.mtimeMs || 0,
          format: (_value, row) => getModified(row),
          align: 'left',
          sortable: true,
          style: 'max-width: 150px; min-width: 150px;',
          headerStyle: 'max-width: 150px; min-width: 150px;',
        },
      ]),
      pagination = reactive({
        page: 1,
        rowsPerPage: 0,
        sortBy: 'label',
        descending: false,
      })

    watch(
      () => props.contents.map((entry) => entry.path),
      (paths) => {
        // A selected row belongs to one directory listing. Clear it when a
        // navigation replaces that listing and the selected path disappears.
        if (selectedNode.value && paths.includes(selectedNode.value.path) !== true) {
          selectedNode.value = null
          emit('select', null)
        }
      },
    )

    // when a node is single-clicked
    function onClick(node) {
      selectedNode.value = node
      emit('select', node)
    }

    // when a node is double-clicked
    function onDblClick(node) {
      selectedNode.value = node
      emit('dblclick', node)
    }

    function onContextMenu(node) {
      onClick(node)
    }

    function rowClick(node) {
      onClick(node)
    }

    function dblRowClick(node) {
      onDblClick(node)
    }

    function getSize(node) {
      if (node.isDir) {
        // Directory sizes are expensive to calculate recursively, so this
        // example leaves them blank instead of blocking the UI.
        return ''
      }
      return prettyBytes(node.metadata?.size || 0)
    }

    function getModified(node) {
      const modified = node.metadata?.mtimeMs
      if (isValidTimestamp(modified) !== true) return ''
      return date.formatDate(modified, 'YYYY-MM-DD HH:mm:ss')
    }

    function getFileNameParts(name) {
      return getFileNameDisplayParts(name)
    }

    function selectedStyleObject(node) {
      // Selection is local to the content view; opening/navigation state lives
      // in MainLayout and the shared explorer store.
      if (node === selectedNode.value) {
        return {
          backgroundColor: '#C0C0C0',
        }
      } else {
        return {
          backgroundColor: 'inherit',
        }
      }
    }

    return {
      selectedNode,
      imageWidth,
      columns,
      pagination,
      onClick,
      onDblClick,
      onContextMenu,
      rowClick,
      dblRowClick,
      getSize,
      getModified,
      getFileNameParts,
      selectedStyleObject,
    }
  },
})
</script>

<style lang="scss" scoped>
.contents-container {
  position: relative;
  width: 100%;
  height: calc(100vh - 50px);
  overflow: auto;
}

.empty-folder {
  display: grid;
  min-height: 200px;
  place-items: center;
  color: $grey-7;
}

.contents-wrapper {
  position: relative;
  width: 100%;
  height: calc(100vh - 50px);
}

.my-sticky-header-table {
  height: calc(100vh - 50px);

  :deep(table) {
    table-layout: fixed;
  }

  .q-table__top,
  .q-table__bottom,
  thead tr:first-child th {
    background-color: #c1f4cd;
  }

  thead tr th {
    position: sticky;
    z-index: 1;
  }

  thead tr:first-child th {
    top: 0;
  }

  &.q-table--loading thead tr:last-child th {
    top: 48px;
  }
}

.file-name-cell {
  min-width: 0;
}

.file-name {
  display: flex;
  min-width: 0;
  max-width: 100%;
  white-space: nowrap;
}

.file-name-start {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-name-end {
  flex: none;
}
</style>
