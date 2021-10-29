<template>
  <q-item
    clickable
    @click="onClick"
  >
    <q-item-section
      v-if="icon"
      avatar
    >
      <q-icon :name="icon" />
    </q-item-section>

    <q-item-section>
      <q-item-label>{{ name }}</q-item-label>
    </q-item-section>
  </q-item>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ShortcutLink',

  props: {
    name: {
      type: String,
      required: true
    },

    path: {
      type: String,
      default: ''
    },

    icon: {
      type: String,
      default: ''
    }
  },

  emits: ['shortcut'],

  setup (props, { emit }) {
    function onClick () {
      const shortcut = {
        name: props.name,
        path: props.path
      }
      emit('shortcut', shortcut)
    }

    return {
      onClick
    }
  }
})
</script>
