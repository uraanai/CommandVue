import type { PresetTypeDefinition } from "./types";
import type { Map as MapLibreMap } from "maplibre-gl";

import { getPanelInstance } from "@/modules/panels/instances";

import { presetTypeRegistry } from "./registry";

/**
 * Three example preset types shipped with the template.
 *
 * Each is fully registered so the UI flows (Manage Presets dialog, Apply
 * Preset dropdown) work end-to-end. Runtime application is wired for
 * **map-style** (calls `map.setStyle`); **map-overlay** and **chart-theme**
 * have stub `applyToPanel` functions that log to the console — they're
 * intentionally minimal because the actual runtime work (loading GeoJSON
 * sources, swapping ECharts color palettes) is application-specific and
 * lands in downstream apps via custom preset types.
 *
 * To add a new preset type: register a definition like one below, optionally
 * import its `editComponent` from `src/components/presets/editors/`.
 */

export interface MapStyleConfig extends Record<string, unknown> {
  styleUrl: string;
  attribution?: string;
}

export const MAP_STYLE_PRESET: PresetTypeDefinition<MapStyleConfig> = {
  id: "map-style",
  title: "Map Style",
  description: "Swap a MapLibre map's vector style at runtime.",
  icon: "palette",
  applicableTo: ["maplibre"],
  defaultConfig: {
    styleUrl: "https://tiles.openfreemap.org/styles/liberty",
  },
  editComponent: () => import("@/components/presets/editors/MapStylePresetEditor.vue"),
  applyToPanel(panelId, config) {
    const map = getPanelInstance<MapLibreMap>(panelId);
    if (!map) return;
    try {
      map.setStyle(config.styleUrl);
    } catch (error) {
      console.warn("[preset:map-style] setStyle failed", { panelId, error });
    }
  },
};

export interface MapOverlayConfig extends Record<string, unknown> {
  name: string;
  geojsonUrl: string;
  color: string;
  opacity: number;
  visible: boolean;
}

export const MAP_OVERLAY_PRESET: PresetTypeDefinition<MapOverlayConfig> = {
  id: "map-overlay",
  title: "Map Overlay",
  description: "Add a GeoJSON overlay layer to a Cesium or MapLibre map.",
  icon: "layers",
  applicableTo: ["cesium", "maplibre"],
  defaultConfig: {
    name: "Untitled overlay",
    geojsonUrl: "",
    color: "#10C4A2",
    opacity: 0.6,
    visible: true,
  },
  editComponent: () => import("@/components/presets/editors/MapOverlayPresetEditor.vue"),
  applyToPanel(panelId, config) {
    // Stub: downstream apps wire the actual layer-creation per their needs.
    // The cesium / maplibre add-source / add-layer dance varies by feature
    // (clustering, styling, hover behavior); shipping a one-size implementation
    // would constrain that surface unnecessarily.
    console.warn("[preset:map-overlay] would apply", { panelId, name: config.name });
  },
  removeFromPanel(panelId, config) {
    console.warn("[preset:map-overlay] would remove", { panelId, name: config.name });
  },
};

export interface ChartThemeConfig extends Record<string, unknown> {
  colorPalette: string[];
  gridStyle: "subtle" | "bold" | "none";
  tooltipMode: "axis" | "item";
}

export const CHART_THEME_PRESET: PresetTypeDefinition<ChartThemeConfig> = {
  id: "chart-theme",
  title: "Chart Theme",
  description: "Apply a color palette and grid style to ECharts panels.",
  icon: "bar-chart-3",
  applicableTo: ["chart"],
  defaultConfig: {
    colorPalette: ["#10C4A2", "#0EA5E9", "#F59E0B", "#EF4444"],
    gridStyle: "subtle",
    tooltipMode: "axis",
  },
  editComponent: () => import("@/components/presets/editors/ChartThemePresetEditor.vue"),
  applyToPanel(panelId, config) {
    // Stub: ECharts theme application requires reconstructing the chart with
    // a registered theme name. Downstream apps that need this either:
    //  - register a theme via `echarts.registerTheme(name, def)` at startup,
    //    then call `chart.setOption({ color: config.colorPalette }, true)`, or
    //  - extend this preset type with a tailored `applyToPanel`.
    console.warn("[preset:chart-theme] would apply", {
      panelId,
      palette: config.colorPalette,
    });
  },
};

export const BUILTIN_PRESET_TYPES = [
  MAP_STYLE_PRESET,
  MAP_OVERLAY_PRESET,
  CHART_THEME_PRESET,
] as const;

let registered = false;

export function registerBuiltinPresetTypes(): void {
  if (registered) return;
  // Cast each generic to the registry's storage shape — without this, the
  // loop's union element type fails to satisfy `register<TConfig>`.
  for (const def of BUILTIN_PRESET_TYPES)
    presetTypeRegistry.register(def as unknown as PresetTypeDefinition);
  registered = true;
}

export function __unregisterBuiltinPresetTypesForTests(): void {
  presetTypeRegistry.__resetForTests();
  registered = false;
}
