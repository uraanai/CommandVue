import { defineStore } from "pinia";
import { shallowRef } from "vue";

import { idbDel, idbGet, idbSet } from "@/utils/storage";

const STORAGE_KEY = "layout:dockview";

/**
 * Layout store — owns the persisted Dockview layout JSON.
 *
 * The store holds the serialized payload in a `shallowRef` so component
 * watchers don't deep-traverse the (potentially large) layout tree. The
 * Dockview API itself is NOT stored here — Pinia stores must remain
 * serializable. The component (`DockLayout.vue`) keeps the API in a
 * `shallowRef` and rehydrates on `onReady` by calling `load()`.
 */
export const useLayoutStore = defineStore("layout", () => {
  const layoutJson = shallowRef<unknown>(null);

  async function load(): Promise<unknown> {
    const stored = await idbGet<unknown>(STORAGE_KEY);
    if (stored !== undefined) {
      layoutJson.value = stored;
      return stored;
    }
    return null;
  }

  async function save(payload: unknown): Promise<void> {
    layoutJson.value = payload;
    await idbSet(STORAGE_KEY, payload);
  }

  async function reset(): Promise<void> {
    layoutJson.value = null;
    await idbDel(STORAGE_KEY);
  }

  return {
    layoutJson,
    load,
    save,
    reset,
  };
});
