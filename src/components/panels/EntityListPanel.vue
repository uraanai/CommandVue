<script setup lang="ts">
import { ListChecks } from "@lucide/vue";
</script>

<template>
  <div
    class="bg-surface-sunken flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
  >
    <ListChecks class="text-accent-500 size-10" />
    <h3 class="text-foreground text-sm font-medium">Entity list</h3>
    <p class="text-muted text-xs">Wires up in Phase 6 (TanStack Table + virtual rows).</p>
  </div>
</template>
