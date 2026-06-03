import type { NotifySeverity, ToastPosition } from "@/components/ui/toastTheme";

import { nanoid } from "nanoid";
import { useToast } from "primevue/usetoast";

import { toPrimeSeverity } from "@/components/ui/toastTheme";
import { useNotificationStore } from "@/stores/notification";

/**
 * App-wide toast/notification producer.
 *
 * Mirrors the `useConfirm` singleton ergonomics: one host (`NotificationOutlets`,
 * mounted in `AppShell`) calls `installNotify()` once to capture the PrimeVue
 * toast handle into the module-level ref below, so ANY caller — components,
 * stores, the WebSocket watcher — can `useNotify().success(...)` without being
 * inside a setup() that can resolve `useToast()`.
 *
 * Design notes:
 *   - **Every outlet is grouped; there is no ungrouped/default sink.** `show`
 *     always resolves `position` (default `bottom-right`) to a group id via
 *     `POSITION_TO_GROUP` and sets `group`, so a `<Toast>` outlet with that group
 *     receives it. Firing into a position whose outlet isn't mounted silently
 *     no-ops in PrimeVue — `NotificationOutlets` renders exactly the key set of
 *     `POSITION_TO_GROUP` (asserted in tests) to make that impossible.
 *   - **Coalescing by `key`.** `replace` (default for keyed) removes the prior
 *     live toast with that key and shows the new one — this is what lets a
 *     "Reconnected" success supersede a sticky "Connection lost" instead of
 *     stacking. `drop` keeps the live one and ignores the new (spam guard).
 *   - PrimeVue mutates the message object it's handed (adds `.id`) and emits the
 *     same object back on `close`/`life-end`; we stash `_cvKey`/`_cvRecordId` on
 *     it so `handleMessageClosed` can clean the live-key map + mark history.
 *   - History is pushed into `useNotificationStore` (the deferred-center seam).
 */

/** The seven canonical positions → their stable outlet group ids. */
export const POSITION_TO_GROUP: Record<ToastPosition, string> = {
  "top-left": "cv-toast-top-left",
  "top-center": "cv-toast-top-center",
  "top-right": "cv-toast-top-right",
  "bottom-left": "cv-toast-bottom-left",
  "bottom-center": "cv-toast-bottom-center",
  "bottom-right": "cv-toast-bottom-right",
  center: "cv-toast-center",
};

/** Default auto-dismiss (ms) for non-sticky toasts. */
export const DEFAULT_LIFE = 5000;
/** Default position when a caller doesn't specify one. */
export const DEFAULT_POSITION: ToastPosition = "bottom-right";

export interface NotifyOptions {
  severity?: NotifySeverity;
  summary: string;
  detail?: string;
  position?: ToastPosition;
  /** Auto-dismiss after this many ms. Ignored when `sticky`. */
  life?: number;
  /** Stay until dismissed (omits `life`). */
  sticky?: boolean;
  /** Logical slot id for coalescing. */
  key?: string;
  /** What to do when a toast with the same `key` is live. Default `replace`. */
  coalesce?: "drop" | "replace";
}

/** Message object handed to PrimeVue, plus the metadata we stash on it. */
interface ToastMessage {
  severity: string;
  summary: string;
  detail?: string;
  group: string;
  life?: number;
  id?: unknown; // assigned by PrimeVue on add
  _cvKey?: string; // coalesce key
  _cvRecordId?: string; // history record id
}

/** The subset of the PrimeVue toast service `useNotify` drives. */
interface ToastHandle {
  add(message: ToastMessage): void;
  remove(message: ToastMessage): void;
  removeGroup(group: string): void;
  removeAllGroups(): void;
}

type Store = ReturnType<typeof useNotificationStore>;

// --- Module-level singletons (captured once via installNotify) --------------
let handle: ToastHandle | null = null;
let store: Store | null = null;
/** key → the currently-live message for that key (for coalescing + cleanup). */
const liveByKey = new Map<string, ToastMessage>();

/**
 * Capture the toast handle + history store. Call ONCE from the outlet host's
 * setup (`NotificationOutlets`), which is mounted inside the app + Pinia.
 */
export function installNotify(): void {
  handle = useToast() as unknown as ToastHandle;
  store = useNotificationStore();
}

function show(options: NotifyOptions): void {
  if (!handle) return; // not installed yet (pre-mount) — no-op rather than throw
  const severity = options.severity ?? "info";
  const position = options.position ?? DEFAULT_POSITION;
  const group = POSITION_TO_GROUP[position];
  const { key } = options;

  if (key) {
    const prev = liveByKey.get(key);
    if (prev) {
      if ((options.coalesce ?? "replace") === "drop") return; // keep the live one
      handle.remove(prev); // replace: drop the prior, then add the new below
      liveByKey.delete(key);
    }
  }

  const message: ToastMessage = {
    severity: toPrimeSeverity(severity),
    summary: options.summary,
    group,
  };
  if (options.detail !== undefined) message.detail = options.detail;
  if (!options.sticky) message.life = options.life ?? DEFAULT_LIFE;
  if (key) message._cvKey = key;

  if (store) {
    const id = nanoid();
    message._cvRecordId = id;
    store.push({
      id,
      severity,
      summary: options.summary,
      detail: options.detail,
      position,
      key,
      createdAt: Date.now(),
      dismissedAt: null,
    });
  }

  handle.add(message);
  if (key) liveByKey.set(key, message);
}

/**
 * Called by `NotificationOutlets` on a toast's `close` / `life-end`. Cleans the
 * live-key map (so a later same-key `drop` isn't wrongly suppressed) and marks
 * the history record dismissed. PrimeVue hands back the same message object we
 * added, with our `_cv*` metadata intact.
 */
export function handleMessageClosed(message: ToastMessage | undefined): void {
  if (!message) return;
  if (message._cvKey && liveByKey.get(message._cvKey) === message) {
    liveByKey.delete(message._cvKey);
  }
  if (message._cvRecordId) store?.markDismissed(message._cvRecordId, Date.now());
}

type Shorthand = Omit<NotifyOptions, "severity">;
type Extra = Omit<NotifyOptions, "severity" | "summary">;

function severityFn(severity: NotifySeverity) {
  return (arg: Shorthand | string, extra?: Extra): void => {
    if (typeof arg === "string") show({ ...extra, severity, summary: arg });
    else show({ ...arg, severity });
  };
}

const api = {
  show,
  success: severityFn("success"),
  info: severityFn("info"),
  warn: severityFn("warning"),
  danger: severityFn("danger"),
  /** Clear every toast in every position. */
  dismissAll(): void {
    handle?.removeAllGroups();
    liveByKey.clear();
    store?.markAllDismissed(Date.now());
  },
  /** Clear every toast at one position. */
  dismissPosition(position: ToastPosition): void {
    const group = POSITION_TO_GROUP[position];
    handle?.removeGroup(group);
    for (const [k, m] of liveByKey) if (m.group === group) liveByKey.delete(k);
    store?.markDismissedByPosition(position, Date.now());
  },
};

export type Notify = typeof api;

export function useNotify(): Notify {
  return api;
}

// --- Test seams -------------------------------------------------------------

/** Test-only — inject a fake toast handle (bypasses `useToast()`). */
export function __setNotifyHandleForTests(fake: ToastHandle | null): void {
  handle = fake;
}

/** Test-only — clear the handle, store, and live-key map. */
export function __resetNotifyForTests(): void {
  handle = null;
  store = null;
  liveByKey.clear();
}
