<template>
  <div class="breadcrumbs">
    <button
      v-for="object in toolbarLinks"
      :key="object.path"
      type="button"
      class="breadcrumb"
      @click="onFolderSelected(object)"
    >
      {{ object.name }}
    </button>
  </div>
</template>

<script>
import { defineComponent, watch, reactive } from 'vue'

export default defineComponent({
  name: 'Breadcrumbs',

  props: {
    absolutePath: {
      type: String,
      required: true,
    },
    pathSeparator: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      required: true,
    },
  },

  emits: ['selected'],

  setup(props, { emit }) {
    const toolbarLinks = reactive([])

    watch(
      () => [props.absolutePath, props.pathSeparator, props.platform],
      ([absolutePath]) => {
        buildToolbarPath(absolutePath)
      },
      { immediate: true },
    )

    function onFolderSelected(node) {
      emit('selected', node.path)
    }

    function buildToolbarPath(absolutePath) {
      if (!props.pathSeparator) return

      // The main process supplies the platform separator through the preload
      // bridge. Using it here supports POSIX roots and Windows drive roots
      // without exposing Node's path module to the sandboxed renderer.
      toolbarLinks.splice(0, toolbarLinks.length)

      if (!absolutePath) {
        return
      }

      const toolbarLinks2 = []
      let path = ''
      const parts = absolutePath.split(props.pathSeparator)
      if (parts.length > 1 && parts[parts.length - 1].trim() === '') {
        parts.pop()
      }

      for (let index = 0; index < parts.length; ++index) {
        let name = ''
        if (index === 0) {
          if (props.platform !== 'win32') {
            name += '(root)'
            path = props.pathSeparator
          }

          if (props.platform === 'win32') {
            path += parts[index]
            name += path
            if (path.endsWith(':') === true) {
              path += props.pathSeparator
              name += props.pathSeparator
            }
          }
        } else {
          if (path.charAt(path.length - 1) !== props.pathSeparator) {
            path += props.pathSeparator
            name += props.pathSeparator
          }

          path += parts[index]
          if (props.platform !== 'win32' && index === 1) {
            name += props.pathSeparator
          }
          name += parts[index]
        }

        const object = {
          path: path,
          name: name,
        }
        toolbarLinks2.push(object)
      }
      toolbarLinks.push(...toolbarLinks2)
    }

    return {
      toolbarLinks,
      onFolderSelected,
    }
  },
})
</script>

<style>
.breadcrumbs {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 28px;
  margin-left: 5px;
  padding: 0 4px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  overflow-x: auto;
}

.breadcrumb {
  appearance: none;
  border: 0;
  padding: 2px;
  color: inherit;
  background: transparent;
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.breadcrumb:hover,
.breadcrumb:focus-visible {
  text-decoration: underline;
}
</style>
