import type { PanelDefinition } from "./types";

import { panelRegistry } from "./registry";

/**
 * The seven built-in panels that ship with CommandVue.
 *
 * Each `id` matches:
 *  - The string passed to `app.component(id, ...)` in `main.ts` (dockview-vue
 *    resolves panel components from the global registry).
 *  - The `addPanel({ component: id, ... })` calls in `DockLayout.vue`.
 *  - The `SEED_PANEL_TYPES` entries in `src/modules/storage/seed.ts`.
 *
 * `serialize` and `restore` are deliberately omitted in Phase B — Phase G is
 * where each panel opts in to per-instance state persistence.
 */
export const BUILTIN_PANELS: readonly PanelDefinition[] = [
  {
    id: "cesium",
    title: "3D Globe",
    description: "Cesium-powered 3D globe with terrain and imagery layers.",
    icon: "globe",
    category: "maps",
    mainPane: true,
    component: () => import("@/components/panels/CesiumPanel.vue"),
  },
  {
    id: "maplibre",
    title: "2D Map",
    description: "MapLibre GL 2D map with vector style support.",
    icon: "map",
    category: "maps",
    component: () => import("@/components/panels/MapLibrePanel.vue"),
  },
  {
    id: "entities",
    title: "Entity List",
    description: "Sortable, filterable list of tracked entities.",
    icon: "list",
    category: "data",
    component: () => import("@/components/panels/EntityListPanel.vue"),
  },
  {
    id: "chart",
    title: "Telemetry Chart",
    description: "ECharts time-series chart for telemetry streams.",
    icon: "bar-chart-3",
    category: "charts",
    component: () => import("@/components/panels/ChartPanel.vue"),
  },
  {
    id: "telemetry",
    title: "Live Telemetry",
    description: "Real-time message feed over WebSocket.",
    icon: "activity",
    category: "monitoring",
    component: () => import("@/components/panels/TelemetryPanel.vue"),
  },
  {
    id: "markdown",
    title: "Briefing",
    description: "Markdown viewer for mission briefings and notes.",
    icon: "file-text",
    category: "docs",
    component: () => import("@/components/panels/MarkdownPanel.vue"),
  },
  {
    id: "symbology",
    title: "Symbology",
    description: "MIL-STD-2525 / APP-6 symbol code reference.",
    icon: "shield",
    category: "tools",
    component: () => import("@/components/panels/SymbologyPanel.vue"),
  },
  {
    id: "components-browser",
    title: "Components",
    description: "Browse and add registered panel types.",
    icon: "layout-grid",
    category: "docs",
    singleton: true,
    component: () => import("@/components/panels/ComponentsPanel.vue"),
  },
] as const;

let registered = false;

/**
 * Registers every built-in panel. Idempotent — calling twice is a no-op,
 * which keeps HMR happy when `main.ts` reloads.
 */
export function registerBuiltinPanels(): void {
  if (registered) return;
  for (const def of BUILTIN_PANELS) panelRegistry.register(def);
  registered = true;
}

/** Test-only — undo `registerBuiltinPanels` so specs can start clean. */
export function __unregisterBuiltinPanelsForTests(): void {
  for (const def of BUILTIN_PANELS) panelRegistry.unregister(def.id);
  registered = false;
}
