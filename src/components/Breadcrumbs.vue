<template>
  <div class="breadcrumbs">
    <span
      v-for="object in toolbarLinks"
      :key="object.path"
      class="breadcrumb"
      @click="onFolderSelected(object)"
    >
      {{ object.name }}
    </span>
  </div>
</template>

<script>
// const path = require('path')
import { getPlatform, getSep } from '../backend/utils.js'
import { defineComponent, onBeforeMount, watch, reactive } from 'vue'

export default defineComponent({
  name: 'Breadcrumbs',

  props: {
    absolutePath: {
      type: String,
      required: true
    }
  },

  emits: ['selected'],

  setup (props, { emit }) {
    const toolbarLinks = reactive([]) // toolbar pathway (links to each folder in path)
    let pathSep = '',
      platform = '',
      hasSep = false

    onBeforeMount(async () => {
      // get path separator for this system
      pathSep = await getSep()
      // get system platform
      platform = await getPlatform()

      hasSep = true

      if (props.absolutePath) {
        buildToolbarPath(props.absolutePath)
      }
    })

    watch(() => props.absolutePath, val => {
      buildToolbarPath(val)
    })

    function onFolderSelected (node) {
      emit('selected', node.path)
    }

    function buildToolbarPath (absolutePath) {
      if (!hasSep) return

      // remove existing
      toolbarLinks.splice(0, toolbarLinks.length)

      // if empty, return
      if (!absolutePath) {
        return
      }

      const toolbarLinks2 = []
      let path = ''
      const parts = absolutePath.split(pathSep)
      if (parts.length > 1 && parts[ parts.length - 1 ].trim() === '') {
        parts.pop()
      }

      for (let index = 0; index < parts.length; ++index) {
        let name = ''
        if (index === 0) {
          if (platform !== 'win32') {
            name += '(root)'
            path = pathSep
          }

          if (platform === 'win32') {
            path += parts[ index ]
            name += path
            if (path.endsWith(':') === true) {
              path += pathSep
              name += pathSep
            }
          }
        }
        else {
          if (path.charAt(path.length - 1) !== pathSep) {
            path += pathSep
            name += pathSep
          }

          path += parts[ index ]
          if (platform !== 'win32' && index === 1) {
            name += pathSep
          }
          name += parts[ index ]
        }

        const object = {
          path: path,
          name: name
        }
        toolbarLinks2.push(object)
      }
      toolbarLinks.push(...toolbarLinks2)
    }

    return {
      toolbarLinks,
      onFolderSelected
    }
  }
})
</script>

<style>
.breadcrumbs {
  width: 100%;
  height: 20px;
  margin-left: 5px;
  background-color: rgba(0, 0, 0, .3);
  border-radius: 4px;
}

.breadcrumb {
  cursor: pointer;
}

.breadcrumb:hover {
  text-decoration: underline;
}
</style>
