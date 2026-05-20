import type { WsMessage } from "@/modules/realtime/protocol";

import { defineStore } from "pinia";
import { computed, ref } from "vue";

const DEFAULT_BUFFER = 50;

/**
 * Telemetry store — rolling buffer of the last N WebSocket messages and
 * a synthetic 1 Hz signal used by `ChartPanel` for demo purposes.
 *
 * Real telemetry is plumbed in Phase 6 panels via `useWebSocketClient`'s
 * `lastMessage` ref, which calls `push()` on each parsed envelope.
 */
export const useTelemetryStore = defineStore("telemetry", () => {
  const recentMessages = ref<WsMessage[]>([]);
  const bufferSize = ref(DEFAULT_BUFFER);

  /** Synthetic 1 Hz scalar series for the demo chart. */
  const signalSeries = ref<{ ts: number; value: number }[]>([]);
  const maxSeriesPoints = 120;

  const messageCount = computed(() => recentMessages.value.length);

  function push(message: WsMessage): void {
    recentMessages.value.push(message);
    while (recentMessages.value.length > bufferSize.value) {
      recentMessages.value.shift();
    }
  }

  function clear(): void {
    recentMessages.value = [];
  }

  function appendSignal(value: number, ts: number = Date.now()): void {
    signalSeries.value.push({ ts, value });
    while (signalSeries.value.length > maxSeriesPoints) {
      signalSeries.value.shift();
    }
  }

  function clearSignal(): void {
    signalSeries.value = [];
  }

  return {
    recentMessages,
    bufferSize,
    signalSeries,
    messageCount,
    push,
    clear,
    appendSignal,
    clearSignal,
  };
});
