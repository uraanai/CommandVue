<script setup lang="ts">
import { Globe2 } from "@lucide/vue";
</script>

<template>
  <div
    class="bg-surface-sunken flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
  >
    <Globe2 class="text-accent-500 size-10" />
    <h3 class="text-foreground text-sm font-medium">Cesium 3D Globe</h3>
    <p class="text-muted text-xs">Wires up in Phase 5 (vite-plugin-static-copy + useCesium).</p>
  </div>
</template>
