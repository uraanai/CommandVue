<script setup lang="ts">
import type { PanelApiProps } from "@/composables/usePanelApi";

import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import { useMapLibre } from "@/composables/useMapLibre";
import { usePanelApi } from "@/composables/usePanelApi";
import { usePanelState } from "@/composables/usePanelState";
import { useToolRegistry } from "@/composables/useToolRegistry";
import { registerPanelInstance, unregisterPanelInstance } from "@/modules/panels/instances";
import { presetTypeRegistry } from "@/modules/presets/registry";
import { TOOLS } from "@/modules/tools";
import { useDrawingsStore } from "@/stores/drawings";
import { usePanelStateStore } from "@/stores/panelState";
import { usePresetStore } from "@/stores/preset";

interface MapLibreState extends Record<string, unknown> {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

const props = defineProps<PanelApiProps>();

// dockview-vue passes the panel api inside the `params` bag — see usePanelApi.
const { api } = usePanelApi(props);

const container = ref<HTMLDivElement | null>(null);
const { map, mount } = useMapLibre();
const drawings = useDrawingsStore();
const panelStateStore = usePanelStateStore();
const presetStore = usePresetStore();

useToolRegistry(map, {
  tools: TOOLS,
  onFinalize: (feature) => {
    drawings.add(feature);
  },
});

function applyAppliedPresets(): void {
  const panelApi = api.value;
  if (!panelApi) return;
  const state = panelStateStore.getState(panelApi.id);
  if (!state) return;
  // Iterate appliedPresetIds in order — later overrides earlier (cascading).
  for (const presetId of state.appliedPresetIds) {
    const preset = presetStore.getPreset(presetId);
    if (!preset) continue;
    const def = presetTypeRegistry.get(preset.presetTypeId);
    if (!def) continue;
    void Promise.resolve(def.applyToPanel(panelApi.id, preset.config));
  }
}

onMounted(async () => {
  if (!container.value) return;
  const instance = mount(container.value);
  const panelApi = api.value;
  if (panelApi) {
    registerPanelInstance(panelApi.id, instance);

    // Wire per-panel state persistence (Phase G). The composable handles
    // debounce + flush-on-unmount + dirty marking; we only own serialize +
    // restore.
    const { save } = usePanelState<MapLibreState>(panelApi.id, {
      serialize: () => {
        const c = instance.getCenter();
        return {
          center: [c.lng, c.lat],
          zoom: instance.getZoom(),
          bearing: instance.getBearing(),
          pitch: instance.getPitch(),
        };
      },
      restore: (state) => {
        instance.jumpTo({
          center: state.center,
          zoom: state.zoom,
          bearing: state.bearing,
          pitch: state.pitch,
        });
      },
    });
    instance.on("moveend", save);
    instance.on("zoomend", save);
    instance.on("rotateend", save);
    instance.on("pitchend", save);
  }

  // Re-apply presets on the first style 'load' (setStyle in a preset's
  // applyToPanel needs the map to be ready).
  instance.once("load", () => applyAppliedPresets());
});

onBeforeUnmount(() => {
  const panelApi = api.value;
  if (panelApi) unregisterPanelInstance(panelApi.id);
});

// Re-apply when this panel's appliedPresetIds changes (e.g. user picks a
// new preset via the Apply Preset dialog while the panel is mounted).
watch(
  () => (api.value ? panelStateStore.getState(api.value.id)?.appliedPresetIds : []),
  () => applyAppliedPresets(),
  { deep: true },
);
</script>

<template>
  <div ref="container" class="bg-brand-950 h-full w-full" data-testid="maplibre-container" />
</template>
