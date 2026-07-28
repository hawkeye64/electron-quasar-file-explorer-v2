<template>
  <div ref="containerRef" class="square" :style="gridItemImageContainerStyleObject">
    <span class="img-helper" />
    <img :src="image" :style="gridItemImageStyleObject" alt="" loading="lazy" decoding="async" />
  </div>
</template>

<script>
import { computed, defineComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { getImageThumbnail } from '../backend/utils.js'

export default defineComponent({
  name: 'GridItemImage',

  props: {
    node: {
      type: Object,
      required: true,
    },
    width: {
      type: Number,
      required: true,
    },
  },

  setup(props) {
    const basePath = 'images/',
      containerRef = ref(null),
      image = ref(getBundledImage())
    let imageObserver = null,
      thumbnailRequested = false

    onMounted(() => {
      if (isThumbnailCandidate() !== true) return

      // IntersectionObserver keeps large image directories cheap: the generic
      // file-type icon is immediate, while real thumbnails are requested only
      // as their grid/list items approach the viewport.
      if (typeof IntersectionObserver !== 'function') {
        void loadThumbnail()
        return
      }

      imageObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            imageObserver?.disconnect()
            void loadThumbnail()
          }
        },
        { rootMargin: '100px' },
      )
      if (containerRef.value) {
        imageObserver.observe(containerRef.value)
      }
    })

    onBeforeUnmount(() => {
      imageObserver?.disconnect()
    })

    const gridItemImageContainerStyleObject = computed(() => {
      return {
        height: props.width + 'px',
        width: props.width + 'px',
      }
    })

    const gridItemImageStyleObject = computed(() => {
      return {
        'max-height': props.width + 'px',
        'max-width': props.width + 'px',
        'vertical-align': 'middle',
      }
    })

    function getBundledImage() {
      if (props.node.mimetype) {
        const parts = props.node.mimetype.split('/')
        const type = parts[0]

        if (type === 'pdf' || props.node.mimetype === 'application/pdf') {
          return basePath + 'pdf.png'
        } else if (
          type === 'text' ||
          type === 'message' ||
          props.node.mimetype === 'application/x-sql' ||
          props.node.mimetype === 'application/javascript' ||
          props.node.mimetype === 'application/json'
        ) {
          return basePath + 'text.png'
        } else if (type === 'video') {
          return basePath + 'movie.png'
        } else if (type === 'application') {
          return basePath + 'binary.png'
        } else if (type === 'image') {
          return basePath + 'image.png'
        }
      }

      if (props.node.isDir) {
        return basePath + 'folder.png'
      }

      // Fallback for unrecognized files.
      return basePath + 'blank.png'
    }

    function isThumbnailCandidate() {
      return (
        props.node.mimetype?.startsWith('image/') === true &&
        props.node.mimetype !== 'image/svg+xml'
      )
    }

    async function loadThumbnail() {
      if (thumbnailRequested) return
      thumbnailRequested = true

      try {
        const thumbnail = await getImageThumbnail(props.node, props.width)
        if (thumbnail) {
          image.value = thumbnail
        }
      } catch {
        // Rejections are reserved for invalid IPC requests. The generic image
        // icon is already displayed as the safe visual fallback.
      }
    }

    return {
      containerRef,
      gridItemImageContainerStyleObject,
      gridItemImageStyleObject,
      image,
    }
  },
})
</script>

<style lang="scss" scoped>
.square {
  text-align: center;
}

.img-helper {
  display: inline-block;
  height: 100%;
  vertical-align: middle;
}
</style>
