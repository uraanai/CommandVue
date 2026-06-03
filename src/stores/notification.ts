import type { NotifySeverity, ToastPosition } from "@/components/ui/toastTheme";

import { defineStore } from "pinia";
import { computed, ref } from "vue";

/**
 * Notification history — a capped ring buffer of every toast `useNotify`
 * emits. This is the **seam** for a future notification center (a bell with an
 * unread badge + a history panel); that surface is deliberately NOT built here
 * (see `.internal/specs/track-a-post-a1b-ux-systems.md` §2.5). What lands now is
 * only the record shape + the dismiss/coalesce reconciliation, so the center can
 * be added later without retrofitting producers.
 *
 * Serializable state only (no DOM refs / no toast handles), per the store
 * rules. The buffer caps at 50, FIFO — same convention as the telemetry store.
 */

/** One emitted notification. `dismissedAt` is null while live, set on
 *  expire / manual close / explicit dismiss / coalesce-replace supersession. */
export interface NotificationRecord {
  /** Stable id (nanoid), survives dismissal. */
  id: string;
  severity: NotifySeverity;
  summary: string;
  detail?: string;
  /** Resolved position the toast was routed to. */
  position: ToastPosition;
  /** Coalesce key, if the producer set one. */
  key?: string;
  /** Epoch ms when emitted. */
  createdAt: number;
  /** Epoch ms when it left the screen, or null while live. */
  dismissedAt: number | null;
}

const MAX_RECORDS = 50;

export const useNotificationStore = defineStore("notification", () => {
  const records = ref<NotificationRecord[]>([]);

  /** Count of still-live records — the future bell's unread badge reads this. */
  const unreadCount = computed(() => records.value.filter((r) => r.dismissedAt === null).length);

  /** Append a record, evicting the oldest when over the cap (FIFO). */
  function push(record: NotificationRecord): void {
    records.value.push(record);
    if (records.value.length > MAX_RECORDS) records.value.shift();
  }

  /** Mark one record dismissed (idempotent — keeps the first dismiss time). */
  function markDismissed(id: string, at: number): void {
    const record = records.value.find((r) => r.id === id);
    if (record && record.dismissedAt === null) record.dismissedAt = at;
  }

  /** Mark every live record at a position dismissed (drives `dismissPosition`). */
  function markDismissedByPosition(position: ToastPosition, at: number): void {
    for (const r of records.value) {
      if (r.position === position && r.dismissedAt === null) r.dismissedAt = at;
    }
  }

  /** Mark every live record dismissed (drives `dismissAll`). */
  function markAllDismissed(at: number): void {
    for (const r of records.value) if (r.dismissedAt === null) r.dismissedAt = at;
  }

  return { records, unreadCount, push, markDismissed, markDismissedByPosition, markAllDismissed };
});

/** Test-only — clear the buffer. Never call from app code. */
export function __resetNotificationsForTests(): void {
  useNotificationStore().records.splice(0);
}
