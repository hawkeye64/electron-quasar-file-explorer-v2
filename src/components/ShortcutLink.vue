<template>
  <q-item
    clickable
    :active="active"
    active-class="shortcut-link--active"
    class="shortcut-link"
    :aria-current="active ? 'location' : undefined"
    @click="onClick"
  >
    <q-item-section v-if="icon" avatar>
      <q-icon :name="icon" />
    </q-item-section>

    <q-item-section>
      <q-item-label>{{ name }}</q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup>
const props = defineProps({
  name: { type: String, required: true },
  path: { type: String, default: '' },
  icon: { type: String, default: '' },
  // Navigation state stays in the parent so every navigation surface agrees.
  active: Boolean,
})
const emit = defineEmits(['shortcut'])

function onClick() {
  emit('shortcut', { name: props.name, path: props.path })
}
</script>

<style scoped>
/*
 * A neutral, rounded selection resembles GNOME Files without pretending the
 * app is a native control. The middle-gray overlay remains legible with both
 * light and dark Quasar palettes used by Linux, macOS, and Windows hosts.
 */
.shortcut-link {
  min-height: 36px;
  margin: 2px 8px;
  border-radius: 6px;
}

.shortcut-link.q-item--active {
  color: inherit;
  background-color: rgb(127 127 127 / 24%);
}
</style>
