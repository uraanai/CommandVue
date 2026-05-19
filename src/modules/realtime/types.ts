export type { WsMessage } from "./protocol";

/** Reactive connection lifecycle states surfaced by `useWebSocketClient`. */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
