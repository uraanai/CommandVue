import type { Ulid } from "@/types/workspace";

/**
 * Panel-instance registry.
 *
 * Map of `panelId → imperative handle`. Each panel component registers its
 * underlying instance (Cesium viewer, MapLibre map, ECharts chart, etc.) on
 * mount and unregisters on teardown. Preset application reads from here so
 * `PresetTypeDefinition.applyToPanel` can reach the live instance without
 * walking the component tree.
 *
 * Why a separate module from the panel registry: the panel registry owns
 * **definitions** (metadata, async loaders); this module owns **live
 * instances** that come and go with mounts. Mixing them would make the
 * panel registry stateful per-mount.
 *
 * Why module-scope and not a Pinia store: the values are deliberately
 * non-serializable (Cesium viewers, MapLibre maps); they must not leak into
 * devtools / persistence / Realtime. Same rationale as the DockviewApi ref
 * in the session store.
 */
const instances = new Map<Ulid, unknown>();

export function registerPanelInstance<T>(panelId: Ulid, api: T): void {
  instances.set(panelId, api);
}

export function unregisterPanelInstance(panelId: Ulid): void {
  instances.delete(panelId);
}

export function getPanelInstance<T = unknown>(panelId: Ulid): T | undefined {
  return instances.get(panelId) as T | undefined;
}

/** Test-only — clear every registration. */
export function __resetPanelInstancesForTests(): void {
  instances.clear();
}
