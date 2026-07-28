import { inject, provide, reactive } from 'vue'
import { explorerStoreKey } from './symbols.js'

// Keep an odd number of evenly spaced choices so the initial size always has
// the same number of smaller and larger steps available in the view menu.
export const gridIconSizes = Object.freeze([32, 48, 64, 80, 96])
const defaultGridIconSize = gridIconSizes[Math.floor(gridIconSizes.length / 2)]

export function useExplorerStore() {
  return inject(explorerStoreKey)
}

export function provideExplorerStore() {
  // This small provide/inject store keeps the example framework-light while
  // still sharing content/list state across layout and view components.
  const store = {
    files: [],
    viewType: 'nodes',
    listType: 'grid',
    gridIconSize: defaultGridIconSize,
    showHiddenFiles: false,
    loading: false,
    error: '',
    warningCount: 0,
  }

  provide(explorerStoreKey, import.meta.env.QUASAR_SERVER ? store : reactive(store))
}
