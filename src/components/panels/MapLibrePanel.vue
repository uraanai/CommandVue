<script setup lang="ts">
import { onMounted, ref } from "vue";

import { useMapLibre } from "@/composables/useMapLibre";

const container = ref<HTMLDivElement | null>(null);
const { mount } = useMapLibre();

onMounted(() => {
  if (!container.value) return;
  mount(container.value);
});
</script>

<template>
  <div ref="container" class="bg-brand-950 h-full w-full" data-testid="maplibre-container" />
</template>
