import type { Ref } from "vue";

import { watch } from "vue";

import { useNotify } from "@/composables/useNotify";

/**
 * **Opt-in example** — raise toasts when the realtime connection drops and
 * recovers. NOT wired by default: the template ships no domain alert semantics
 * (CLAUDE.md — no business logic). A downstream app calls this once with its
 * WebSocket client's reactive `status` (from `useWebSocketClient`):
 *
 * ```ts
 * const ws = useWebSocketClient({ url });
 * useConnectionNotifications(ws.status);
 * ```
 *
 * Both toasts share the `ws-status` key with `coalesce: 'replace'`, so the
 * "Reconnected" success **supersedes** the still-live sticky "Connection lost"
 * instead of stacking beneath it — the case the toast system's coalesce design
 * exists for. The reconnect path goes `CLOSED → CONNECTING → OPEN`, so we track
 * a `lostShown` flag rather than relying on the immediate previous status (which
 * is `CONNECTING`, not `CLOSED`, at the moment of recovery).
 */
export function useConnectionNotifications(
  status: Readonly<Ref<"CLOSED" | "CONNECTING" | "OPEN">>,
): void {
  const notify = useNotify();
  let hasConnected = false;
  let lostShown = false;

  watch(status, (next) => {
    if (next === "OPEN") {
      if (lostShown) {
        notify.success({
          summary: "Reconnected",
          detail: "Live connection restored.",
          key: "ws-status",
          coalesce: "replace",
        });
        lostShown = false;
      }
      hasConnected = true;
    } else if (next === "CLOSED" && hasConnected && !lostShown) {
      notify.danger({
        summary: "Connection lost",
        detail: "Attempting to reconnect…",
        sticky: true,
        key: "ws-status",
        coalesce: "replace",
      });
      lostShown = true;
    }
  });
}
