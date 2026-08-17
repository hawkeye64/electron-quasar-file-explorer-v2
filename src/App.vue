<template>
  <router-view />
</template>
<script setup>
import { provideExplorerStore } from './store/explorerStore.js'

provideExplorerStore()
</script>
