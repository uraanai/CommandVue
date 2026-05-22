<script setup lang="ts">
import { Wifi, WifiOff } from "@lucide/vue";
import { computed } from "vue";

import { useConnectionStore } from "@/stores/connection";

const connection = useConnectionStore();

// Map the canonical ConnectionStatus enum to a tri-state UI label.
const status = computed<"live" | "connecting" | "offline">(() => {
  switch (connection.status) {
    case "connected":
      return "live";
    case "connecting":
      return "connecting";
    default:
      return "offline";
  }
});

const dotClass = computed(() => {
  if (status.value === "live") return "text-success";
  if (status.value === "connecting") return "text-warning";
  return "text-faint";
});
</script>

<template>
  <span class="text-muted flex items-center gap-1 text-xs" :title="`WebSocket: ${status}`">
    <Wifi v-if="status === 'live'" :class="['size-3', dotClass]" />
    <WifiOff v-else :class="['size-3', dotClass]" />
    <span>{{ status }}</span>
  </span>
</template>
