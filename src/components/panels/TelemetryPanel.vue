<script setup lang="ts">
import { Radio, Send, WifiOff } from "@lucide/vue";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import { computed, onBeforeUnmount, onMounted, watch } from "vue";

import Button from "@/components/ui/Button.vue";
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

const tablePT = {
  root: { class: "h-full" },
  tableContainer: { class: "h-full" },
  table: { class: "w-full font-mono text-[11px]" },
  bodyRow: { class: "border-border border-b" },
  bodyCell: { class: "px-2 py-1 align-top" },
  emptyMessage: { class: "p-3 text-muted text-xs" },
};
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
      <Button variant="primary" size="sm" @click="sendMessage('demo.echo', { sentAt: Date.now() })">
        <Send class="size-3" />
        send
      </Button>
    </header>

    <div class="text-muted min-h-0 flex-1 overflow-auto">
      <DataTable :value="recent" data-key="id" size="small" :pt="tablePT">
        <template #empty>
          No messages yet. Waiting for echo from <code>{{ DEFAULT_URL }}</code
          >…
        </template>
        <Column header="Time" header-style="width: 10rem">
          <template #body="{ data }">
            <span class="text-faint">{{ formatTimestamp(data.ts) }}</span>
          </template>
        </Column>
        <Column field="type" header="Type" header-style="width: 6rem">
          <template #body="{ data }">
            <span class="text-foreground">{{ data.type }}</span>
          </template>
        </Column>
        <Column header="Payload">
          <template #body="{ data }">
            <span class="break-all">{{ JSON.stringify(data.payload) }}</span>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
