import { nanoid } from "nanoid";

/**
 * Wire envelope for every message that crosses the WebSocket boundary.
 *
 * Keeping a uniform envelope simplifies routing, debugging, and testing:
 * every consumer can dispatch on `type`, every store can timestamp on `ts`,
 * and every log can correlate by `id`. Payloads are domain-specific.
 *
 * Example:
 *   { type: "telemetry.update", id: "abc", ts: 1700000000000, payload: {...} }
 *   { type: "entity.created",   id: "def", ts: 1700000000050, payload: {...} }
 */
export interface WsMessage<T = unknown> {
  /** Event name, dot-namespaced (`<domain>.<action>`). */
  type: string;
  /** Idempotency / correlation id (nanoid). */
  id: string;
  /** Epoch milliseconds — set by the producer. */
  ts: number;
  /** Domain payload. Stay JSON-serializable. */
  payload: T;
}

/** Construct a fresh message with a generated id and current timestamp. */
export function createMessage<T>(type: string, payload: T): WsMessage<T> {
  return {
    type,
    id: nanoid(),
    ts: Date.now(),
    payload,
  };
}

/** Type guard for an unknown value that may have come from the wire. */
export function isWsMessage(value: unknown): value is WsMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.type === "string" &&
    typeof m.id === "string" &&
    typeof m.ts === "number" &&
    "payload" in m
  );
}

/** Serialize to the wire. Throws on cycles, etc. — let the caller handle. */
export function serializeMessage<T>(message: WsMessage<T>): string {
  return JSON.stringify(message);
}

/** Parse a wire string into a typed message or return null if it's malformed. */
export function parseMessage(raw: string): WsMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isWsMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
