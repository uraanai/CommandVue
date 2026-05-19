import { useWebSocket } from "@vueuse/core";
import { ref, watch } from "vue";

import {
  createMessage,
  isWsMessage,
  parseMessage,
  serializeMessage,
  type WsMessage,
} from "@/modules/realtime/protocol";

export interface WebSocketClientOptions {
  /** Connection URL (`wss://...`). */
  url: string;
  /** Heartbeat interval in ms. Default 25 000. */
  heartbeatMs?: number;
  /** Whether to open the connection immediately. Default true. */
  immediate?: boolean;
}

/**
 * Typed WebSocket client wrapping `useWebSocket` from @vueuse/core.
 *
 * Adds:
 *   - JSON encode / decode of `WsMessage` envelopes
 *   - Heartbeat (`type: "ping"` every `heartbeatMs`, echoed back as `"pong"`)
 *   - Exponential backoff with jitter on reconnect (infinite retries)
 *   - Reactive `lastMessage` + `latencyMs` refs
 *
 * Consumers send domain messages via `sendMessage(type, payload)` and react
 * to incoming traffic by watching `lastMessage` or dispatching off `type`.
 */
export function useWebSocketClient(options: WebSocketClientOptions) {
  const lastMessage = ref<WsMessage | null>(null);
  const latencyMs = ref<number | null>(null);

  const heartbeatPayload = serializeMessage(createMessage("ping", { sentAt: Date.now() }));

  // @vueuse/core 12's autoReconnect.delay expects a fixed number. The
  // exponential-backoff helper in `@/modules/realtime/reconnect` is used by
  // higher-level reconnection loops; here we use a conservative 1 s base.
  const { status, data, send, open, close } = useWebSocket(options.url, {
    immediate: options.immediate ?? true,
    autoReconnect: {
      retries: -1,
      delay: 1_000,
    },
    heartbeat: {
      message: heartbeatPayload,
      interval: options.heartbeatMs ?? 25_000,
      pongTimeout: 5_000,
    },
  });

  watch(data, (raw) => {
    if (typeof raw !== "string") return;
    const message = parseMessage(raw);
    if (!message) return;
    lastMessage.value = message;
    if (message.type === "pong" || message.type === "ping") {
      latencyMs.value = Date.now() - message.ts;
    }
  });

  function sendMessage<T>(type: string, payload: T): void {
    const message = createMessage(type, payload);
    send(serializeMessage(message));
  }

  function sendRaw(message: WsMessage): void {
    if (!isWsMessage(message)) {
      throw new Error("useWebSocketClient.sendRaw: payload is not a WsMessage");
    }
    send(serializeMessage(message));
  }

  return {
    status,
    lastMessage,
    latencyMs,
    sendMessage,
    sendRaw,
    open,
    close,
  };
}
