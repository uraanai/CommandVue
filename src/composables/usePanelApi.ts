import type { DockviewApi, DockviewPanelApi } from "dockview-vue";

import { computed, type ComputedRef } from "vue";

/**
 * Dockview panel prop access (dockview-vue 6).
 *
 * dockview-vue mounts every panel component with a **single** prop named
 * `params`. Its `VueRenderer.init` (dockview-vue@6.4.0
 * `dist/dockview-vue.es.js`) does:
 *
 * ```js
 * const props = { params: parameters.params, api: parameters.api,
 *                 containerApi: parameters.containerApi,
 *                 tabLocation: parameters.tabLocation };
 * mountVueComponent(component, parent, { params: props }, element);
 * ```
 *
 * So a panel receives `props.params`, and the panel + container apis live on
 * it as `props.params.api` / `props.params.containerApi` — NOT as separate
 * top-level props. Panels that declared `api` / `containerApi` directly got
 * `undefined`, which silently disabled per-panel persistence and broke the
 * UnassignedPanel "Assign" / MissingPanelPlaceholder "Reassign" / "Remove"
 * actions. dockview-vue ships no public type for the bag (the React-side
 * `IDockviewPanelProps` name doesn't exist here), so we model the fields we
 * use.
 */
export interface DockviewPanelParams {
  /** Custom params from `addPanel({ params })` — unused by the built-in panels. */
  params?: Record<string, unknown>;
  api?: DockviewPanelApi;
  containerApi?: DockviewApi;
  tabLocation?: unknown;
}

export interface PanelApiProps {
  params?: DockviewPanelParams;
}

/**
 * Resolve the dockview panel + container apis from a panel component's props.
 *
 * Returns computed refs so consumers stay reactive across dockview's
 * `VueRenderer.update` (which re-binds the same `params` prop). `api.value`
 * is populated synchronously by the time `setup()` runs — dockview binds the
 * bag at component creation — so top-of-setup reads are safe.
 */
export function usePanelApi(props: PanelApiProps): {
  api: ComputedRef<DockviewPanelApi | undefined>;
  containerApi: ComputedRef<DockviewApi | undefined>;
} {
  return {
    api: computed(() => props.params?.api),
    containerApi: computed(() => props.params?.containerApi),
  };
}
