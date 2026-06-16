<template>
  <div
    class="griditemcontainer"
    :style="gridItemContainerStyleObject"
    @dblclick.prevent="onDblClick"
    @click="onClick"
  >
    <div class="griditemimage" :style="gridItemImageStyleObject">
      <grid-item-image :node="node" :width="width" />
    </div>
    <div class="griditemtext" :style="gridItemTextStyleObject" :title="node.name">
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
    GridItemImage,
  },

  props: {
    node: {
      type: Object,
    },
    selectedNode: {
      type: Object,
    },
    viewType: {
      type: String,
    },
  },
  emits: ['click', 'dblClick'],

  setup(props, { emit }) {
    const width = 75,
      fontSize = 12,
      delay = 200
    let timer = null

    const gridItemContainerStyleObject = computed(() => {
      if (props.node === props.selectedNode) {
        // current node is selected
        return {
          backgroundColor: '#C0C0C0',
          width: width + 'px',
        }
      } else {
        return {
          backgroundColor: 'inherit',
          width: width + 'px',
        }
      }
    })

    const gridItemImageStyleObject = computed(() => {
      return {
        width: width + 'px',
        height: width + 'px',
      }
    })

    const gridItemTextStyleObject = computed(() => {
      return {
        fontSize: fontSize + 'px',
      }
    })

    watch(
      () => props.viewType,
      (val) => {
        if (props.viewType === 'nodes' && props.node === props.selectedNode) {
          // TODO: Jeff
          // this.$el.scrollIntoView()
        }
      },
    )

    function onClick() {
      // Browsers emit two click events before a dblclick. A short timer lets the
      // parent treat single-click selection and double-click open separately.
      if (timer) {
        return
      }

      emit('click', props.node)

      timer = setTimeout(() => {
        clearTimeout(timer)
      }, delay)
    }

    function onDblClick() {
      if (timer) {
        clearTimeout(timer)
      }
      // Vue event names are case-sensitive in JavaScript; keep the emitted name
      // aligned with the parent listener used by this demo.
      // eslint-disable-next-line vue/custom-event-name-casing
      emit('dblClick', props.node)
    }

    return {
      width,
      gridItemContainerStyleObject,
      gridItemImageStyleObject,
      gridItemTextStyleObject,
      onClick,
      onDblClick,
    }
  },
})
</script>

<style scoped>
.selected {
  background-color: '#C0C0C0';
}
.griditemcontainer {
  margin: 5px;
  height: 135px;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  -webkit-transition: 'all 0.5s ease-in-out';
  transition: 'all 0.5s ease-in-out';
}
.griditemcontainer:hover {
  background-color: rgba(0, 0, 0, 0.05);
  box-shadow:
    0 1px 5px rgba(0, 0, 0, 0.2),
    0 2px 2px rgba(0, 0, 0, 0.14),
    0 3px 1px -2px rgba(0, 0, 0, 0.12);
  -webkit-transition: 'all 0.5s ease-in-out';
  transition: 'all 0.5s ease-in-out';
}
.griditemimage {
  display: flex;
  align-items: center;
  justify-content: center;
}
.griditemimage:hover {
  -webkit-filter: brightness(108%);
  filter: brightness(108%);
}
.griditemtext {
  width: 100%;
  max-height: 3.75em;
  line-height: 1.25;
  overflow: hidden;
  text-align: center;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
</style>
