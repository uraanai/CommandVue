import { shallowRef, type Ref } from "vue";

import { registerPopoutWindow, unregisterPopoutWindow } from "./usePopoutThemeSync";

/**
 * Reactive registry of open dockview pop-out windows (Track B Phase 6c).
 *
 * `session.doPopOut` reports each window via dockview's `onDidOpen` / `onWillClose`
 * callbacks; this module turns that into a reactive list so `DockLayout` can render
 * one `DockPopoutContextMenu` per live window (a right-click menu inside the child
 * window). It also fans the same lifecycle out to `usePopoutThemeSync`, so the two
 * pop-out concerns (theme mirroring + context menu) share ONE register/unregister
 * pair at the call site instead of drifting apart.
 *
 * A `Window` is a live DOM handle, NOT serializable state, so this lives in a
 * composable module — never a Pinia store (CLAUDE.md state rule 4). Each entry
 * carries a stable numeric `id` for `v-for` keying (Window objects make poor keys).
 */
export interface PopoutWindowEntry {
  id: number;
  win: Window;
}

let seq = 0;
const windows = shallowRef<PopoutWindowEntry[]>([]);

/** Track a freshly-opened pop-out (also starts its theme mirroring). */
export function trackPopoutWindow(win: Window): void {
  registerPopoutWindow(win);
  if (windows.value.some((e) => e.win === win)) return;
  windows.value = [...windows.value, { id: (seq += 1), win }];
}

/** Drop a pop-out that is closing / docking back (also stops its theme mirroring). */
export function untrackPopoutWindow(win: Window): void {
  unregisterPopoutWindow(win);
  windows.value = windows.value.filter((e) => e.win !== win);
}

/** Reactive list of open pop-out windows for the context-menu hosts to render. */
export function usePopoutWindows(): Readonly<Ref<PopoutWindowEntry[]>> {
  return windows;
}

/** Test seam: clear the registry for per-test isolation. */
export function __resetForTests(): void {
  windows.value = [];
  seq = 0;
}
