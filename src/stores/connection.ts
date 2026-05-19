import { defineStore } from "pinia";
import { ref } from "vue";

import type { ConnectionStatus } from "@/modules/realtime/types";

/**
 * Connection store — surfaces WebSocket lifecycle state for the StatusBar
 * and any component that wants to react to up / down transitions.
 */
export const useConnectionStore = defineStore("connection", () => {
  const status = ref<ConnectionStatus>("disconnected");
  const lastError = ref<string | null>(null);
  const reconnectAttempts = ref(0);
  const latencyMs = ref<number | null>(null);

  function setStatus(next: ConnectionStatus): void {
    status.value = next;
  }

  function setLatency(ms: number | null): void {
    latencyMs.value = ms;
  }

  function recordError(message: string): void {
    lastError.value = message;
    status.value = "error";
  }

  function clearError(): void {
    lastError.value = null;
  }

  function incrementReconnect(): void {
    reconnectAttempts.value += 1;
  }

  function resetReconnect(): void {
    reconnectAttempts.value = 0;
  }

  return {
    status,
    lastError,
    reconnectAttempts,
    latencyMs,
    setStatus,
    setLatency,
    recordError,
    clearError,
    incrementReconnect,
    resetReconnect,
  };
});
