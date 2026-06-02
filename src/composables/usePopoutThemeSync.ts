/**
 * Pop-out theme mirroring (Track B Phase 6a).
 *
 * dockview's `addPopoutGroup` relocates a group's live DOM into a child browser
 * window and copies the opener's STYLESHEETS in — so Tailwind utilities and our
 * component CSS work there. What it does NOT copy is the runtime theme state that
 * lives on the opener's `<html>`: the `data-theme` / `data-theme-id` /
 * `data-density` attributes (which select the right token rules) and the inline
 * `--*` custom properties a custom theme writes (which aren't in any stylesheet).
 * Without those, a pop-out renders on default tokens — broken theming.
 *
 * This module keeps every open pop-out's `<html>` in lock-step with the opener's.
 * A single `MutationObserver` on the opener's `<html>` catches BOTH theme apply
 * paths — `applyResolved` (writes `data-theme`) and the custom-theme apply (writes
 * `data-theme-id` + the inline `--*` props) — plus density changes, so we don't
 * have to hook either function. Registered windows are mirrored immediately
 * on open and on every subsequent change; closed windows are pruned.
 *
 * Module-level singletons (like `useTheme`) so the session pop-out actions'
 * `onDidOpen` / `onWillClose` and `AppShell`'s init share one observer + window set.
 */

const MIRRORED_ATTRS = ["data-theme", "data-theme-id", "data-density"] as const;

const popoutWindows = new Set<Window>();
let observer: MutationObserver | null = null;

/** Copy the opener's theme attributes + inline token style onto one pop-out. */
function syncWindow(win: Window): void {
  if (win.closed) {
    popoutWindows.delete(win);
    return;
  }
  try {
    const src = document.documentElement;
    const dst = win.document.documentElement;
    for (const attr of MIRRORED_ATTRS) {
      const v = src.getAttribute(attr);
      if (v === null) dst.removeAttribute(attr);
      else dst.setAttribute(attr, v);
    }
    // Copy ONLY the theme `--*` custom properties, not any other inline style the
    // opener might carry now or later (a scroll-lock `overflow`, a `--vh` fix, …),
    // which would wrongly override the pop-out root's own styles.
    let tokens = "";
    for (let i = 0; i < src.style.length; i += 1) {
      const prop = src.style.item(i);
      if (prop.startsWith("--")) tokens += `${prop}:${src.style.getPropertyValue(prop)};`;
    }
    dst.setAttribute("style", tokens);
  } catch {
    // A window torn down mid-sync (race with close) — drop it; the observer's
    // next pass and `onWillClose` keep the set honest.
    popoutWindows.delete(win);
  }
}

function syncAll(): void {
  for (const win of [...popoutWindows]) syncWindow(win);
}

/**
 * Start the observer. Idempotent; call once from `AppShell` on mount. Watches the
 * opener `<html>` for theme/density attribute changes and inline-style (token)
 * changes, re-mirroring every open pop-out.
 */
export function initPopoutThemeSync(): void {
  if (observer || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver(() => syncAll());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [...MIRRORED_ATTRS, "style"],
  });
}

/** Track a freshly-opened pop-out and mirror the current theme onto it now. */
export function registerPopoutWindow(win: Window): void {
  popoutWindows.add(win);
  syncWindow(win);
}

/** Stop tracking a pop-out (its window is closing / docked back). */
export function unregisterPopoutWindow(win: Window): void {
  popoutWindows.delete(win);
}

/** Test seam: number of pop-outs currently mirrored. */
export function __popoutWindowCountForTests(): number {
  return popoutWindows.size;
}

/** Test seam: clear the tracked-window set for per-test isolation. */
export function __resetForTests(): void {
  popoutWindows.clear();
}
