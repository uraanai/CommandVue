<script setup lang="ts">
import { Map } from "@lucide/vue";
</script>

<template>
  <div
    class="bg-surface-sunken flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
  >
    <Map class="text-accent-500 size-10" />
    <h3 class="text-foreground text-sm font-medium">MapLibre 2D Map</h3>
    <p class="text-muted text-xs">Wires up in Phase 5 (OpenFreeMap Liberty style + useMapLibre).</p>
  </div>
</template>
