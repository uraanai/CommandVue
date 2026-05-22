<script setup lang="ts">
import type { DockviewPanelApi } from "dockview-vue";

import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import { useMapLibre } from "@/composables/useMapLibre";
import { useToolRegistry } from "@/composables/useToolRegistry";
import { registerPanelInstance, unregisterPanelInstance } from "@/modules/panels/instances";
import { presetTypeRegistry } from "@/modules/presets/registry";
import { TOOLS } from "@/modules/tools";
import { useDrawingsStore } from "@/stores/drawings";
import { usePanelStateStore } from "@/stores/panelState";
import { usePresetStore } from "@/stores/preset";

interface Props {
  api?: DockviewPanelApi;
}

const props = defineProps<Props>();

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
  if (!props.api) return;
  const state = panelStateStore.getState(props.api.id);
  if (!state) return;
  // Iterate appliedPresetIds in order — later overrides earlier (cascading).
  for (const presetId of state.appliedPresetIds) {
    const preset = presetStore.getPreset(presetId);
    if (!preset) continue;
    const def = presetTypeRegistry.get(preset.presetTypeId);
    if (!def) continue;
    void Promise.resolve(def.applyToPanel(props.api.id, preset.config));
  }
}

onMounted(async () => {
  if (!container.value) return;
  const instance = mount(container.value);
  if (props.api) registerPanelInstance(props.api.id, instance);
  // Re-apply presets on the first style 'load' (setStyle in a preset's
  // applyToPanel needs the map to be ready).
  instance.once("load", () => applyAppliedPresets());
});

onBeforeUnmount(() => {
  if (props.api) unregisterPanelInstance(props.api.id);
});

// Re-apply when this panel's appliedPresetIds changes (e.g. user picks a
// new preset via the Apply Preset dialog while the panel is mounted).
watch(
  () => (props.api ? panelStateStore.getState(props.api.id)?.appliedPresetIds : []),
  () => applyAppliedPresets(),
  { deep: true },
);
</script>

<template>
  <div ref="container" class="bg-brand-950 h-full w-full" data-testid="maplibre-container" />
</template>
