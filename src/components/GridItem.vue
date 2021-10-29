<template>
  <div
    class="griditemcontainer"
    :style="gridItemContainerStyleObject"
    @dblclick.prevent="onDblClick"
    @click="onClick"
  >
    <div
      class="griditemimage"
      :style="gridItemImageStyleObject"
    >
      <grid-item-image
        :node="node"
        :width="width"
      />
    </div>
    <div
      class="griditemtext"
      :style="gridItemTextStyleObject"
    >
      {{ node.name }}
    </div>
  </div>
</template>

<script>
import { defineComponent, computed, watch } from 'vue'
import GridItemImage from './GridItemImage.vue'

export default defineComponent({
  name: 'GridItem',

  components: {
    GridItemImage
  },

  props: {
    node: {
      type: Object
    },
    selectedNode: {
      type: Object
    },
    viewType: {
      type: String
    }
  },
  emits: [ 'click', 'dblClick' ],

  setup (props, { emit }) {
    const
      width = 75,
      fontSize = 12,
      delay = 200
    let timer = null

    const gridItemContainerStyleObject = computed(() => {
      if (props.node === props.selectedNode) {
        // current node is selected
        return {
          backgroundColor: '#C0C0C0',
          width: width + 'px'
        }
      }
      else {
        return {
          backgroundColor: 'inherit',
          width: width + 'px'
        }
      }
    })

    const gridItemImageStyleObject = computed(() => {
      return {
        width: width + 'px',
        height: width + 'px'
      }
    })

    const gridItemTextStyleObject = computed(() => {
      return {
        fontSize: fontSize + 'px'
      }
    })

    watch(() => props.viewType, (val) => {
      if (props.viewType === 'nodes' && (props.node === props.selectedNode)) {
        // TODO: Jeff
        // this.$el.scrollIntoView()
      }
    })

    function onClick () {
      if (timer) {
        return
      }

      // emit the click
      emit('click', props.node)

      // prevent multiple single-clicks
      timer = setTimeout(() => {
        clearTimeout(timer)
      }, delay)
    }

    function onDblClick () {
      if (timer) {
        clearTimeout(timer)
      }
      // eslint-disable-next-line vue/custom-event-name-casing
      emit('dblClick', props.node)
    }

    return {
      width,
      gridItemContainerStyleObject,
      gridItemImageStyleObject,
      gridItemTextStyleObject,
      onClick,
      onDblClick
    }
  }
})
</script>

<style scoped>
.selected {
  background-color: '#C0C0C0';
}
.griditemcontainer {
  margin: 5px;
  height: auto;
  word-wrap: break-word;
  border-radius: 4px;
  -webkit-transition: 'all 0.5s ease-in-out';
  transition: 'all 0.5s ease-in-out';
}
.griditemcontainer:hover {
  background-color: rgba(0, 0, 0, .05);
  box-shadow: 0 1px 5px rgba(0,0,0,0.2), 0 2px 2px rgba(0,0,0,0.14), 0 3px 1px -2px rgba(0,0,0,0.12);
  -webkit-transition: 'all 0.5s ease-in-out';
  transition: 'all 0.5s ease-in-out';
}
.griditemimage {
  display:flex;
  align-items:center;
  justify-content:center;
}
.griditemimage:hover {
  -webkit-filter: brightness(108%);
  filter: brightness(108%);
}
.griditemtext {
  text-align: center;
  word-wrap: break-word;
}
</style>
