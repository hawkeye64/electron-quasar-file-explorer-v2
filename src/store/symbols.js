const hasSymbol = typeof Symbol === 'function'
  && typeof Symbol.toStringTag === 'symbol'

export const explorerStoreKey = hasSymbol === true
  ? Symbol('_explorer_store_')
  : '_explorer_store_'
