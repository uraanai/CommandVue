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
 * Module-level singletons (like `useTheme`) so `usePopoutWindows` (which fans the
 * pop-out `onDidOpen` / `onWillClose` lifecycle here) and `AppShell`'s init share
 * one observer + window set.
 */

const MIRRORED_ATTRS = ["data-theme", "data-theme-id", "data-density"] as const;

const popoutWindows = new Set<Window>();
let observer: MutationObserver | null = null;
let syncScheduled = false;

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

// --- C3 font-face mirroring --------------------------------------------------
// `syncWindow` mirrors the token VALUES (incl. `--font-family-*`); this path
// mirrors the FACES — the Google css2 `<link>`s `useFontLoader` injects into the
// opener — so a pop-out's text isn't tofu. Keyed by family (a Map, not the
// plan's `${key} ${href}` Set: family names contain spaces, e.g. "Open Sans",
// which `split(" ")` would corrupt).
/** Font <link> hrefs registered by useFontLoader, keyed by family. */
export const registeredFontHrefs = new Map<string, string>();

/**
 * Inject one font stylesheet into a pop-out's `<head>` if absent. Origin-safe:
 * callers only ever pass hrefs built by `useFontLoader`. The family key is
 * charset-allowlisted, so the `[data-cv-font-key="<family>"]` selector needs no
 * escaping.
 */
export function injectFontLinkIntoWindow(win: Window, href: string, key: string): void {
  if (win.closed) return;
  try {
    const doc = win.document;
    if (doc.head.querySelector(`link[data-cv-font-key="${key}"]`)) return;
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.crossOrigin = "anonymous";
    link.dataset.cvFontKey = key;
    doc.head.appendChild(link);
  } catch {
    // window torn down mid-inject — register-time backfill covers it
  }
}

/** Called by useFontLoader when a new font href is registered; mirrors it into
 *  every open pop-out and records it for register-time backfill. */
export function mirrorFontLinkToAllPopouts(href: string, key: string): void {
  registeredFontHrefs.set(key, href);
  for (const win of [...popoutWindows]) injectFontLinkIntoWindow(win, href, key);
}

/**
 * Start the observer. Idempotent; call once from `AppShell` on mount. Watches the
 * opener `<html>` for theme/density attribute changes and inline-style (token)
 * changes, re-mirroring every open pop-out.
 */
export function initPopoutThemeSync(): void {
  if (observer || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [...MIRRORED_ATTRS, "style"],
  });
}

/**
 * Coalesce a burst of mutations into a single `syncAll()` per animation frame.
 * The Theme Studio (A2a) writes many token mutations while a slider is dragged;
 * without batching, each one would rebuild every pop-out's entire inline style.
 * Falls back to a microtask where `requestAnimationFrame` is unavailable
 * (jsdom / SSR) so mirroring still happens.
 */
function scheduleSync(): void {
  if (syncScheduled) return;
  syncScheduled = true;
  const flush = (): void => {
    syncScheduled = false;
    syncAll();
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(flush);
  else queueMicrotask(flush);
}

/** Track a freshly-opened pop-out and mirror the current theme onto it now. */
export function registerPopoutWindow(win: Window): void {
  popoutWindows.add(win);
  syncWindow(win);
  // Backfill any fonts loaded before this pop-out opened.
  for (const [key, href] of registeredFontHrefs) injectFontLinkIntoWindow(win, href, key);
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
  registeredFontHrefs.clear();
  syncScheduled = false;
}
