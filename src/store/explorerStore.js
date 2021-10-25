import { inject, provide, reactive } from 'vue'
import { explorerStoreKey } from './symbols.js'

export function useExplorerStore () {
  return inject(explorerStoreKey)
}

export function provideExplorerStore () {
  const store = {
    files: [],
    viewType: 'nodes',
    listType: 'grid'
  }

  provide(
    explorerStoreKey,
    process.env.SERVER === true ? store : reactive(store)
  )
}
