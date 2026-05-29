import { inject, provide, reactive } from "vue";
import { explorerStoreKey } from "./symbols.js";

export function useExplorerStore() {
  return inject(explorerStoreKey);
}

export function provideExplorerStore() {
  const store = {
    files: [],
    viewType: "nodes",
    listType: "grid",
  };

  provide(explorerStoreKey, import.meta.env.QUASAR_SERVER ? store : reactive(store));
}
