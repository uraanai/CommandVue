import type { Ulid } from "@/types/workspace";

import { onBeforeUnmount, watch } from "vue";

import { usePanelStateStore } from "@/stores/panelState";
import { useSessionStore } from "@/stores/session";

interface UsePanelStateOptions<TState> {
  /** Pure reducer producing the state to persist from the current panel signals. */
  serialize: () => TState;
  /** Apply a previously persisted state onto the live panel. Called once on mount. */
  restore: (state: TState) => void | Promise<void>;
  /** Debounce window for save writes. Defaults to 400 ms. */
  debounceMs?: number;
  /** Read the persisted state before calling `restore`. Defaults to `panelStateStore.getState`. */
  initialState?: () => TState | undefined;
}

/**
 * Per-panel state persistence helper.
 *
 * Panels that opt in to state persistence call this from `setup` with their
 * `panelId` (from `api.id`). The composable:
 *   1. Reads the persisted state from `panelStateStore` and dispatches
 *      `restore()` once on the next microtask (giving the panel time to
 *      finish constructing its imperative instance — Cesium viewer,
 *      MapLibre map, etc.).
 *   2. Returns a `save()` function the panel calls whenever its signals
 *      change. Writes are debounced (default 400 ms) and also flushed on
 *      unmount.
 *   3. Marks `session.dirty` after each successful save so the chrome's
 *      "Unsaved" indicator lights up.
 *
 * The composable does NOT install its own reactivity — panels decide which
 * events should trigger a save (e.g. MapLibre's `moveend`, ECharts's
 * `dataZoom`). That keeps the save cadence predictable.
 */
export function usePanelState<TState extends Record<string, unknown>>(
  panelId: Ulid,
  options: UsePanelStateOptions<TState>,
): { save: () => void; flush: () => Promise<void> } {
  const panelStateStore = usePanelStateStore();
  const session = useSessionStore();
  const debounceMs = options.debounceMs ?? 400;

  let timer: null | ReturnType<typeof setTimeout> = null;
  let lastSerialized: null | string = null;

  async function persist(): Promise<void> {
    const state = options.serialize();
    const serialized = JSON.stringify(state);
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;
    await panelStateStore.updateState(panelId, { state });
    session.markDirty();
  }

  function save(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void persist();
    }, debounceMs);
  }

  async function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    await persist();
  }

  // Restore once on mount. Run via `watch` with `immediate` so it lands in
  // the same microtask as the panel's own `onMounted` work.
  watch(
    () => panelId,
    () => {
      const existing = options.initialState
        ? options.initialState()
        : (panelStateStore.getState(panelId)?.state as TState | undefined);
      if (existing) {
        void Promise.resolve(options.restore(existing));
        lastSerialized = JSON.stringify(existing);
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      void persist();
    }
  });

  return { save, flush };
}
