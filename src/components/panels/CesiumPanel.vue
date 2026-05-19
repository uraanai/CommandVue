<script setup lang="ts">
import { Cartesian3 } from "cesium";
import { onMounted, ref } from "vue";

import { useCesium } from "@/composables/useCesium";

const container = ref<HTMLDivElement | null>(null);
const { viewer, mount } = useCesium();

onMounted(() => {
  if (!container.value) return;
  mount(container.value);

  // Default camera: looking down on the demo area (lon 70 / lat 30, ~5000 km alt).
  viewer.value?.camera.setView({
    destination: Cartesian3.fromDegrees(70, 30, 5_000_000),
  });

  // Two demo entities so the panel isn't empty on first paint. Real symbology
  // (milsymbol billboards) lights up in Phase 6 when the symbology module is wired.
  viewer.value?.entities.add({
    id: "demo-alpha",
    name: "Alpha",
    position: Cartesian3.fromDegrees(70.5, 30.2),
    point: { pixelSize: 10 },
  });
  viewer.value?.entities.add({
    id: "demo-bravo",
    name: "Bravo",
    position: Cartesian3.fromDegrees(69.5, 29.7),
    point: { pixelSize: 10 },
  });
});
</script>

<template>
  <div ref="container" class="bg-brand-950 h-full w-full" data-testid="cesium-container" />
</template>
