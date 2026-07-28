import { inject, provide, reactive } from 'vue'
import { explorerStoreKey } from './symbols.js'

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
    loading: false,
    error: '',
    warningCount: 0,
  }

  provide(explorerStoreKey, import.meta.env.QUASAR_SERVER ? store : reactive(store))
}
