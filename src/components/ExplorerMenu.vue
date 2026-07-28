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
      <q-card-section class="about-dialog__header">
        <img :src="fileExplorerIcon" width="72" height="72" alt="" class="about-dialog__icon" />

        <div>
          <div class="text-h5 text-weight-medium">File Explorer</div>
          <div class="text-subtitle2 text-grey-7">Version {{ appVersion }}</div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <p class="q-mt-none">
          A cross-platform teaching example for secure filesystem browsing with Quasar and Electron.
        </p>
        <p class="text-body2 text-grey-8">
          Filesystem access stays in Electron’s main process and crosses a narrow, sandboxed preload
          bridge.
        </p>

        <dl class="about-dialog__versions q-mb-none">
          <div>
            <dt>Quasar</dt>
            <dd>v{{ quasarVersion }}</dd>
          </div>
          <div>
            <dt>Electron</dt>
            <dd>v{{ appInfo.electronVersion }}</dd>
          </div>
        </dl>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn v-close-popup autofocus unelevated color="primary" label="Close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { defineComponent, onBeforeMount, reactive, ref } from 'vue'
import quasarPackage from 'quasar/package.json'
import appPackage from '../../package.json'
import fileExplorerIcon from '../assets/file-explorer-icon.svg'
import { getAppInfo } from '../backend/utils.js'
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
      aboutDialogOpen = ref(false),
      appInfo = reactive({
        electronVersion: '—',
      })

    onBeforeMount(async () => {
      try {
        Object.assign(appInfo, await getAppInfo())
      } catch {
        // About information is useful but must never prevent the explorer from
        // starting if the runtime metadata IPC call unexpectedly fails.
      }
    })

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
      appInfo,
      appVersion: appPackage.version,
      quasarVersion: quasarPackage.version,
      fileExplorerIcon,
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
  width: min(460px, calc(100vw - 32px));
  border-radius: 12px;
}

.about-dialog__header {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-block: 24px;
}

.about-dialog__icon {
  flex: none;
  filter: drop-shadow(0 4px 8px rgb(0 0 0 / 18%));
}

.about-dialog__versions {
  overflow: hidden;
  border: 1px solid $grey-4;
  border-radius: 8px;
}

.about-dialog__versions > div {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 24px;
  padding: 10px 12px;
}

.about-dialog__versions > div + div {
  border-top: 1px solid $grey-4;
}

.about-dialog__versions dt {
  font-weight: 500;
}

.about-dialog__versions dd {
  margin: 0;
  color: $grey-7;
  font-variant-numeric: tabular-nums;
}
</style>
