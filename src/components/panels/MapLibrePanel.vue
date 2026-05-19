<script setup lang="ts">
import { onMounted, ref } from "vue";

import { useMapLibre } from "@/composables/useMapLibre";
import { useToolRegistry } from "@/composables/useToolRegistry";
import { TOOLS } from "@/modules/tools";
import { useDrawingsStore } from "@/stores/drawings";

const container = ref<HTMLDivElement | null>(null);
const { map, mount } = useMapLibre();
const drawings = useDrawingsStore();

// Register the built-in tools against this panel's map handle. Activation
// is driven externally by `useToolsStore.activeId` (set from the future
// command palette / toolbar / keyboard shortcuts in Phase 7c).
useToolRegistry(map, {
  tools: TOOLS,
  onFinalize: (feature) => {
    drawings.add(feature);
  },
});

onMounted(() => {
  if (!container.value) return;
  mount(container.value);
});
</script>

<template>
  <div ref="container" class="bg-brand-950 h-full w-full" data-testid="maplibre-container" />
</template>
