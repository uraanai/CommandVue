# Real-time

CommandVue uses **native WebSocket only** — no Socket.IO, no
custom WS framework. We layer a tiny typed envelope over `@vueuse/core`'s
`useWebSocket` to give every message a predictable shape and to
centralize reconnect / heartbeat behavior.

## The envelope

```ts
// src/modules/realtime/protocol.ts
export interface WsMessage<T = unknown> {
  type: string; // dot-namespaced: "entity.created", "telemetry.update"
  id: string; // nanoid, set by the producer
  ts: number; // epoch ms, set by the producer
  payload: T; // domain-specific
}
```

Helpers:

- `createMessage(type, payload)` — stamps a fresh `id` + `ts`.
- `isWsMessage(value)` — type-guard for incoming wire data.
- `serializeMessage(msg)` — `JSON.stringify` (throws on cycles).
- `parseMessage(raw)` — `JSON.parse` + `isWsMessage`, returns `null`
  if malformed.

A single envelope means every consumer can dispatch on `type`, every
store can timestamp on `ts`, and every log can correlate by `id`.

## `useWebSocketClient`

```ts
// src/composables/useWebSocketClient.ts
const {
  status, // "CONNECTING" | "OPEN" | "CLOSING" | "CLOSED"
  lastMessage, // WsMessage | null
  latencyMs, // number | null (computed from echoed pings)
  sendMessage, // (type, payload) => void
  open,
  close,
} = useWebSocketClient({ url, heartbeatMs: 25_000 });
```

Internals:

- Wraps `useWebSocket` with `autoReconnect: { retries: -1, delay: 1000 }`.
  A fixed 1 s delay today; a `calculateBackoff()` helper in
  `src/modules/realtime/reconnect.ts` is ready for a future
  exponential-backoff retry loop.
- Heartbeat: a `ping` message every 25 s, echoed back as `pong`;
  `latencyMs` is computed as `Date.now() - msg.ts` for ping/pong
  envelopes.
- Inbound traffic flows through `parseMessage`; non-conforming strings
  are silently dropped (no throws into the watcher).

## Demo wiring

`TelemetryPanel.vue` connects to `wss://echo.websocket.events` (a
public echo server) so the demo works out of the box. Sends a `ping`
every 5 s, pushes echoed messages into `useTelemetryStore`, and
renders the last 50.

```ts
const DEFAULT_URL = import.meta.env.VITE_WS_URL ?? "wss://echo.websocket.events";
```

## Configuration

`VITE_WS_URL` in `.env.local` overrides the demo endpoint. Use this
in production:

```bash
# .env.local
VITE_WS_URL=wss://api.example.com/telemetry
```

Vite bakes the value into the bundle at build time. To rotate it
without rebuilding, route through nginx (`proxy_pass`) instead — see
`docs/deployment.md`.

## Adding a domain message type

1. Define your payload type:

   ```ts
   // somewhere in your domain modules
   export interface EntityCreatedPayload {
     entityId: string;
     name: string;
     position: { lon: number; lat: number };
   }
   ```

2. Send:

   ```ts
   sendMessage<EntityCreatedPayload>("entity.created", {
     entityId: nanoid(),
     name: "Alpha-001",
     position: { lon: 70, lat: 30 },
   });
   ```

3. Dispatch on receive:

   ```ts
   watch(lastMessage, (msg) => {
     if (!msg) return;
     switch (msg.type) {
       case "entity.created":
         entities.add(msg.payload as EntityCreatedPayload);
         break;
       case "telemetry.update":
         telemetry.push(msg);
         break;
       // ...
     }
   });
   ```

The envelope's `type` field is intentionally a plain string, not a
TypeScript union — downstream forks define their own vocabulary and
shouldn't need to edit the template's types.

## What the template deliberately doesn't ship

- **No Socket.IO.** Native WebSocket is the locked stack choice.
- **No request / response RPC layer.** Use `fetch` (or a client you
  add downstream) for that. WS is fire-and-forget telemetry +
  push notifications.
- **No auth handshake.** If your backend needs a token, add it as a
  query string on the URL (`wss://api/?token=...`) or via a backend
  proxy that authenticates the upgrade.
- **No reconnect-with-backoff state surfaced.** `useWebSocket`'s fixed
  delay is good enough for echo-style demos; production deployments
  with sensitive reconnect timing should plug in
  `calculateBackoff()` from `@/modules/realtime/reconnect` via a
  custom watcher (planned for the roadmap).

## See also

- `tests/unit/protocol.spec.ts` — envelope create / parse / serialize.
- `tests/unit/reconnect.spec.ts` — backoff bounds and capping.
- `src/stores/connection.ts` — the lifecycle store surfaced to StatusBar.
