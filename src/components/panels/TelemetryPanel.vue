<script setup lang="ts">
import { Radio, Send, WifiOff } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, watch } from "vue";

import { useWebSocketClient } from "@/composables/useWebSocketClient";
import { useTelemetryStore } from "@/stores/telemetry";
import { formatTimestamp } from "@/utils/format";

const DEFAULT_URL = import.meta.env.VITE_WS_URL ?? "wss://echo.websocket.events";

const telemetry = useTelemetryStore();

const { status, lastMessage, latencyMs, sendMessage, close } = useWebSocketClient({
  url: DEFAULT_URL,
  heartbeatMs: 25_000,
});

let pingTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  pingTimer = setInterval(() => {
    if (status.value === "OPEN") {
      sendMessage("ping", { sentAt: Date.now() });
    }
  }, 5_000);
});

watch(lastMessage, (msg) => {
  if (msg) telemetry.push(msg);
});

onBeforeUnmount(() => {
  if (pingTimer) clearInterval(pingTimer);
  close();
});

const statusLabel = computed(() => {
  switch (status.value) {
    case "OPEN":
      return "connected";
    case "CONNECTING":
      return "connecting";
    case "CLOSED":
      return "disconnected";
    default:
      return String(status.value).toLowerCase();
  }
});

const statusColor = computed(() => {
  if (status.value === "OPEN") return "text-emerald-400";
  if (status.value === "CONNECTING") return "text-yellow-400";
  return "text-faint";
});

const recent = computed(() => telemetry.recentMessages.slice().reverse().slice(0, 50));
</script>

<template>
  <div class="bg-surface-sunken flex h-full w-full flex-col">
    <header
      class="border-border bg-surface-raised flex items-center gap-3 border-b px-3 py-2 text-xs"
    >
      <span class="flex items-center gap-1.5" :class="statusColor">
        <Radio v-if="status === 'OPEN'" class="size-3.5" />
        <WifiOff v-else class="size-3.5" />
        <span>{{ statusLabel }}</span>
      </span>
      <span class="text-muted">·</span>
      <span class="text-muted">latency: {{ latencyMs !== null ? `${latencyMs}ms` : "—" }}</span>
      <span class="text-muted">·</span>
      <span class="text-muted"
        >buffer: {{ telemetry.messageCount }}/{{ telemetry.bufferSize }}</span
      >
      <span class="text-faint ml-auto truncate text-[10px]" :title="DEFAULT_URL">{{
        DEFAULT_URL
      }}</span>
      <button
        type="button"
        class="bg-accent-600 hover:bg-accent-500 inline-flex items-center gap-1 rounded px-2 py-0.5 text-white"
        @click="sendMessage('demo.echo', { sentAt: Date.now() })"
      >
        <Send class="size-3" />
        send
      </button>
    </header>

    <div class="text-muted min-h-0 flex-1 overflow-auto font-mono text-[11px]">
      <p v-if="recent.length === 0" class="p-3">
        No messages yet. Waiting for echo from <code>{{ DEFAULT_URL }}</code
        >…
      </p>
      <table v-else class="w-full">
        <tbody>
          <tr v-for="msg in recent" :key="msg.id" class="border-border border-b">
            <td class="text-faint w-40 px-2 py-1 align-top">{{ formatTimestamp(msg.ts) }}</td>
            <td class="text-foreground w-24 px-2 py-1 align-top">{{ msg.type }}</td>
            <td class="px-2 py-1 align-top break-all">{{ JSON.stringify(msg.payload) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
