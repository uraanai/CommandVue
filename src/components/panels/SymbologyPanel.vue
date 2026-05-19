<script setup lang="ts">
import { Shield } from "@lucide/vue";
</script>

<template>
  <div
    class="bg-surface-sunken flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
  >
    <Shield class="text-accent-500 size-10" />
    <h3 class="text-foreground text-sm font-medium">Standardized symbology</h3>
    <p class="text-muted text-xs">
      Wires up in Phase 6 (milsymbol + MIL-STD-2525 / APP-6 SIDC codes).
    </p>
  </div>
</template>
