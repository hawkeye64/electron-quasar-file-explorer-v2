<template>
  <router-view />
</template>
<script>
import { defineComponent } from 'vue'
import { provideExplorerStore } from './store/explorerStore.js'

export default defineComponent({
  name: 'App',
  setup () {
    provideExplorerStore()
  }
})
</script>
