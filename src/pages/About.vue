<template>
  <div v-if="store.files && store.files.length" class="contents-container">
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import { useExplorerStore } from '../store/explorerStore.js'

export default defineComponent({
  name: 'Contents',

  setup () {
    const store = useExplorerStore()

    return {
      store
    }
  }
})
</script>
