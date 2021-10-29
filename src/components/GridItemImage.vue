<template>
  <div
    class="square"
    :style="gridItemImageContainerStyleObject"
  >
    <span class="img-helper" />
    <img
      :src="image"
      :style="gridItemImageStyleObject"
    >
  </div>
</template>

<script>
import { defineComponent, ref, computed, onBeforeMount } from 'vue'
import { getImageFile } from '../backend/utils.js'

export default defineComponent({
  name: 'GridItemImage',

  props: {
    node: {
      type: Object,
      required: true
    },
    width: {
      type: Number,
      required: true
    }
  },

  setup (props) {
    const basePath = 'images/',
      image = ref(null)

    onBeforeMount(async () => {
      // get the image representig this GridItem
      image.value = await getImage()
    })

    const gridItemImageContainerStyleObject = computed(() => {
      return {
        height: props.width + 'px',
        width: props.width + 'px'
      }
    })

    const gridItemImageStyleObject = computed(() => {
      return {
        'max-height': props.width + 'px',
        'max-width': props.width + 'px',
        'vertical-align': 'middle'
      }
    })

    async function getImage () {
      // mimeType can be false if it was not recognized
      if (props.node.mimetype) {
        const parts = props.node.mimetype.split('/')
        const type = parts[ 0 ]
        const subtype = parts[ 1 ]
        if (type === 'pdf'
          || props.node.mimetype === 'application/pdf') {
          return basePath + 'pdf.png'
        }
        else if (type === 'text'
          || type === 'message'
          || props.node.mimetype === 'application/x-sql'
          || props.node.mimetype === 'application/javascript'
          || props.node.mimetype === 'application/json') {
          return basePath + 'text.png'
        }
        else if (type === 'video') {
          return basePath + 'movie.png'
        }
        else if (type === 'application') {
          return basePath + 'binary.png'
        }
        else if (type === 'image') {
          if (subtype === 'svg+xml') {
            return basePath + 'image.png'
          }
          try {
            // return a thumbnail image
            return await getImageFile(props.node.path)
          }
          catch (err) {
            return basePath + 'image.png'
          }
        }
      }

      // is this a folder?
      if (props.node.isDir) {
        return basePath + 'folder.png'
      }

      // for all "unrecongized" types
      return basePath + 'blank.png'
    }

    return {
      gridItemImageContainerStyleObject,
      gridItemImageStyleObject,
      image
    }
  }
})
</script>

<style lang="sass">
.square
  text-align: center

.img-helper
  display: inline-block
  height: 100%
  vertical-align: middle
</style>
