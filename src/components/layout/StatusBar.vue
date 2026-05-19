<script setup lang="ts">
import { Activity, Wifi, WifiOff } from "@lucide/vue";
import { computed } from "vue";

/**
 * StatusBar — connection / FPS / coordinate readout.
 *
 * Phase 4 ships static placeholders. Phase 5 wires the coordinate readout to
 * the active map; Phase 6 wires the WS pill to `useConnectionStore`; FPS can
 * be wired to a `useFps` composable later.
 */
const wsConnected = computed(() => false);
const fps = computed(() => "—");
const coords = computed(() => "30.0000°N · 70.0000°E");
</script>

<template>
  <footer
    class="border-border bg-surface-raised text-muted flex h-[var(--spacing-statusbar)] items-center gap-4 border-t px-3 text-xs"
  >
    <span class="flex items-center gap-1.5">
      <Wifi v-if="wsConnected" class="text-success size-3.5" />
      <WifiOff v-else class="text-faint size-3.5" />
      <span>WS: {{ wsConnected ? "live" : "offline" }}</span>
    </span>
    <span class="flex items-center gap-1.5">
      <Activity class="size-3.5" />
      <span>FPS: {{ fps }}</span>
    </span>
    <span class="ml-auto font-mono">{{ coords }}</span>
  </footer>
</template>
