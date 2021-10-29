<template>
  <div
    v-if="contents && contents.length"
    class="contents-container"
  >
    <div class="contents-wrapper">
      <div
        v-if="listType === 'grid'"
        class="row justify-left"
      >
        <template
          v-for="node in contents"
          :key="node.path"
        >
          <grid-item
            :node="node"
            :selected-node="selectedNode"
            :view-type="viewType"
            class="non-selectable"
            @click="onClick"
            @dblClick="onDblClick"
          />
        </template>
      </div>

      <div
        v-if="listType === 'list'"
        id="content-scroll"
        style="min-height: 100%;"
      >
        <q-table
          id="content"
          v-model:pagination="pagination"
          dense
          hide-bottom
          flat
          :rows="contents"
          :columns="columns"
          row-key="path"
          separator="none"
          class="no-border-radius my-sticky-header-table"
          style="min-height: 100%;"
        >
          <template #body="props">
            <q-tr
              :id="props.row.path"
              :props="props"
              :style="selectedStyleObject(props.row)"
              class="non-selectable cursor-pointer"
              @click.stop="rowClick(props.row)"
              @dblclick.stop="dblRowClick(props.row)"
            >
              <q-td
                key="type"
                :props="props"
                :style="'width: ' + imageWidth + 'px;'"
              >
                <grid-item-image
                  :key="props.row.path"
                  :node="props.row"
                  :width="imageWidth"
                />
              </q-td>
              <q-td
                key="label"
                :props="props"
              >
                {{ props.row.name }}
              </q-td>
              <q-td
                key="size"
                :props="props"
              >
                {{ getSize(props.row) }}
              </q-td>
              <q-td
                key="modified"
                :props="props"
              >
                {{ getModified(props.row) }}
              </q-td>
            </q-tr>
          </template>
        </q-table>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, reactive } from 'vue'
import { date } from 'quasar'
import { useExplorerStore } from '../store/explorerStore.js'
import prettyBytes from 'pretty-bytes'
import GridItem from '../components/GridItem.vue'
import GridItemImage from '../components/GridItemImage.vue'

export default defineComponent({
  name: 'Contents',

  components: {
    GridItem,
    GridItemImage
  },

  props: {
    contents: {
      type: Array
    },
    listType: {
      type: String
    },
    viewType: {
      type: String
    }
  },

  emits: [ 'click', 'dblClick' ],

  setup (props, { emit }) {
    const
      store = useExplorerStore(),
      selectedNode = ref(null),
      imageWidth = 25,
      columns = reactive([
        {
          name: 'type',
          required: true,
          label: 'Type',
          field: 'label',
          align: 'center',
          sortable: false,
          style: 'max-width: 50px;',
          headerStyle: 'max-width: 50px;'
        },
        {
          name: 'label',
          required: true,
          label: 'Name',
          field: 'label',
          align: 'left',
          sortable: true,
          style: 'width: 100%',
          headerStyle: 'width: 100%'
        },
        {
          name: 'size',
          label: 'Size',
          field: (row) => row.data,
          format: getSize,
          align: 'right',
          sortable: true,
          sort: (a, b) => parseInt(a.stat.size) - parseInt(b.stat.size),
          style: 'max-width: 80px; min-width: 80px;',
          headerStyle: 'max-width: 80px; min-width: 80px;'
        },
        {
          name: 'modified',
          label: 'Modified',
          field: (row) => row.data,
          format: getModified,
          align: 'left',
          sortable: true,
          sort: (a, b) => parseFloat(a.stat.mtimeMs) - parseFloat(b.stat.mtimeMs),
          style: 'max-width: 150px; min-width: 150px;',
          headerStyle: 'max-width: 150px; min-width: 150px;'
        }
      ]),
      pagination = reactive({
        page: 1,
        rowsPerPage: 0,
        sortBy: 'name',
        descending: false
      })

    // when a node is single-clicked
    function onClick (node) {
      selectedNode.value = node
      emit('click', node)
    }

    // when a node is double-clicked
    function onDblClick (node) {
      selectedNode.value = node
      emit('dblClick', node)
    }

    function rowClick (node) {
      onClick(node)
    }

    function dblRowClick (node) {
      onDblClick(node)
    }

    function getSize (node) {
      if (node.isDir) {
        // return node.metadata.size + ' Items'
        return ''
      }
      return prettyBytes(node.metadata.size)
    }

    function getModified (node) {
      if (node.metadata.mtime.valueOf() === 0) return ''
      return date.formatDate(node.metadata.mtime, 'YYYY-MM-DD hh:mm:ss')
    }

    function selectedStyleObject (node) {
      if (node === selectedNode.value) {
        return {
          backgroundColor: '#C0C0C0'
        }
      }
      else {
        return {
          backgroundColor: 'inherit'
        }
      }
    }

    function getIcon (node) {
      return 'menu'
    }

    return {
      store,
      selectedNode,
      imageWidth,
      columns,
      pagination,
      onClick,
      onDblClick,
      rowClick,
      dblRowClick,
      getSize,
      getModified,
      selectedStyleObject,
      getIcon
    }
  }
})
</script>

<style lang="sass" scoped>
.contents-container
  position: relative
  top: 0
  left: 0
  width: 100%
  height: calc(100vh - 50px)
  overflow: auto

.contents-wrapper
  position: relative
  width: 100%
  height: calc(100vh - 50px)

.my-sticky-header-table
  /* height or max-height is important */
  height: calc(100vh - 50px)

  .q-table__top,
  .q-table__bottom,
  thead tr:first-child th
    /* bg color is important for th; just specify one */
    background-color: #c1f4cd

  thead tr th
    position: sticky
    z-index: 1
  thead tr:first-child th
    top: 0

  /* this is when the loading indicator appears */
  &.q-table--loading thead tr:last-child th
    /* height of all previous header rows */
    top: 48px

// #content .q-table-container
//     border-radius: 0 !important
//     -webkit-box-shadow: inherit !important
//     box-shadow: inherit !important
//     position: relative
//     min-height: 100vh

// #content-scroll >>> #content .q-table-container
//   box-shadow: none

// #content-scroll >>> #content .q-table-middle.scroll
//   overflow: auto

// #content-scroll >>> #content thead tr th
//   position: sticky
//   position: -webkit-sticky
//   background: lightgrey
//   top: 0px
//   z-index: 1

// #content-scroll >>> #content .q-table table
//   display: block
//   width: 100%
//   min-width: 100%

// #content-scroll >>> #content .q-table thead,
// #content-scroll >>> #content .q-table tr,
// #content-scroll >>> #content .q-table th,
// #content-scroll >>> #content .q-table td
//   height: 24px !important

// #content-scroll >>> #content .q-table thead,
// #content-scroll >>> #content .q-table tr
//   width: 100% !important
//   display: inline-table !important

// #content-scroll >>> #content .q-table tbody
//   display: block
//   position: relative
//   overflow: auto
//   width: 100%
//   min-width: 100%
//   min-height: 200px
//   max-height: calc(100vh - 80px)
</style>
