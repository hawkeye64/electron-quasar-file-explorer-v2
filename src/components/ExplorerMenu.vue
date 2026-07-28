<template>
  <q-btn flat dense round icon="more_vert" aria-label="Open application menu">
    <q-menu anchor="bottom right" self="top right" :offset="[0, 8]">
      <q-list class="explorer-menu">
        <q-item v-close-popup clickable @click="$emit('new-window')">
          <q-item-section>New Window</q-item-section>
          <q-item-section side>{{ primaryShortcut('N') }}</q-item-section>
        </q-item>

        <q-separator />

        <q-item>
          <q-item-section>Icon Size</q-item-section>
          <q-item-section side>
            <div class="row no-wrap q-gutter-xs">
              <q-btn
                flat
                dense
                round
                icon="zoom_out"
                size="sm"
                :disable="!canDecreaseIconSize"
                aria-label="Decrease icon size"
                @click="$emit('decrease-icon-size')"
              >
                <q-tooltip>{{ primaryShortcut('−') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                icon="zoom_in"
                size="sm"
                :disable="!canIncreaseIconSize"
                aria-label="Increase icon size"
                @click="$emit('increase-icon-size')"
              >
                <q-tooltip>{{ primaryShortcut('+') }}</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>

        <q-item v-close-popup clickable @click="$emit('set-view', 'grid')">
          <q-item-section avatar>
            <q-icon name="grid_view" />
          </q-item-section>
          <q-item-section>Grid View</q-item-section>
          <q-item-section side>{{ primaryShortcut('1') }}</q-item-section>
        </q-item>

        <q-item v-close-popup clickable @click="$emit('set-view', 'list')">
          <q-item-section avatar>
            <q-icon name="view_list" />
          </q-item-section>
          <q-item-section>List View</q-item-section>
          <q-item-section side>{{ primaryShortcut('2') }}</q-item-section>
        </q-item>

        <q-separator />

        <q-item v-close-popup clickable @click="$emit('toggle-hidden-files')">
          <q-item-section avatar>
            <q-icon v-if="showHiddenFiles" name="check" />
          </q-item-section>
          <q-item-section>Show Hidden Files</q-item-section>
          <q-item-section side>{{ primaryShortcut('H') }}</q-item-section>
        </q-item>

        <q-item v-close-popup clickable @click="openLocationDialog">
          <q-item-section avatar>
            <q-icon name="drive_file_move" />
          </q-item-section>
          <q-item-section>Enter Location</q-item-section>
          <q-item-section side>{{ primaryShortcut('O') }}</q-item-section>
        </q-item>

        <q-item v-close-popup clickable @click="$emit('parent')">
          <q-item-section avatar>
            <q-icon name="arrow_upward" />
          </q-item-section>
          <q-item-section>Parent Folder</q-item-section>
          <q-item-section side>Alt+↑</q-item-section>
        </q-item>

        <q-item v-close-popup clickable @click="$emit('refresh')">
          <q-item-section avatar>
            <q-icon name="refresh" />
          </q-item-section>
          <q-item-section>Refresh</q-item-section>
          <q-item-section side>
            {{ primaryShortcut('R') }}{{ platform === 'darwin' ? '' : ' / F5' }}
          </q-item-section>
        </q-item>

        <q-separator />

        <q-item v-close-popup clickable @click="aboutDialogOpen = true">
          <q-item-section>About File Explorer</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>

  <q-dialog v-model="locationDialogOpen">
    <q-card class="location-dialog">
      <q-form @submit="submitLocation">
        <q-card-section>
          <div class="text-h6">Enter Location</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="locationInput"
            autofocus
            outlined
            label="Absolute folder path"
            spellcheck="false"
            :rules="[
              (value) =>
                isAbsoluteFileSystemPath(value, platform) ||
                'Enter an absolute folder path for this operating system.',
            ]"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup flat label="Cancel" />
          <q-btn color="primary" label="Open" type="submit" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>

  <q-dialog v-model="aboutDialogOpen">
    <q-card class="about-dialog">
      <q-card-section>
        <div class="text-h6">File Explorer</div>
        <p class="q-mb-none">
          A cross-platform example of secure filesystem browsing with Quasar and Electron.
        </p>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn v-close-popup flat color="primary" label="Close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { defineComponent, ref } from 'vue'
import { isAbsoluteFileSystemPath, normalizeEnteredFileSystemPath } from '../utils/fileExplorer.js'

export default defineComponent({
  name: 'ExplorerMenu',

  props: {
    platform: {
      type: String,
      required: true,
    },
    currentPath: {
      type: String,
      required: true,
    },
    showHiddenFiles: Boolean,
    canDecreaseIconSize: Boolean,
    canIncreaseIconSize: Boolean,
  },

  emits: [
    'new-window',
    'decrease-icon-size',
    'increase-icon-size',
    'set-view',
    'toggle-hidden-files',
    'open-path',
    'parent',
    'refresh',
  ],

  setup(props, { emit, expose }) {
    const locationDialogOpen = ref(false),
      locationInput = ref(''),
      aboutDialogOpen = ref(false)

    // macOS applications use Command where Windows and Linux applications use
    // Control. Keeping labels platform-aware makes the in-app menu honest even
    // though the same Vue component renders on all three operating systems.
    function primaryShortcut(key) {
      return props.platform === 'darwin' ? `⌘${key}` : `Ctrl+${key}`
    }

    function openLocationDialog() {
      locationInput.value = props.currentPath
      locationDialogOpen.value = true
    }

    function submitLocation() {
      emit('open-path', normalizeEnteredFileSystemPath(locationInput.value, props.platform))
      locationDialogOpen.value = false
    }

    // MainLayout owns global keyboard events; exposing this one focused action
    // lets Ctrl/Cmd+O open the same dialog as the menu without duplicating it.
    expose({ openLocationDialog })

    return {
      locationDialogOpen,
      locationInput,
      aboutDialogOpen,
      primaryShortcut,
      openLocationDialog,
      submitLocation,
      isAbsoluteFileSystemPath,
    }
  },
})
</script>

<style lang="scss" scoped>
.explorer-menu {
  min-width: 280px;
  padding: 6px;
}

.explorer-menu :deep(.q-item) {
  min-height: 40px;
  border-radius: 6px;
}

.explorer-menu :deep(.q-item__section--side) {
  color: $grey-6;
}

.location-dialog {
  width: min(520px, calc(100vw - 32px));
}

.about-dialog {
  width: min(380px, calc(100vw - 32px));
}
</style>
