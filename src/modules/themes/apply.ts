import type { Theme } from "@/types/theme";

/**
 * Theme application engine.
 *
 * Writes a theme's token overrides onto `:root` as inline CSS variables and
 * sets the three identity attributes (`data-theme-id`, `data-theme`,
 * `data-density`). Cleans up cleanly when another theme is applied — without
 * tracking which keys came from the previous theme, switching themes would
 * leave stale variables behind that bleed into the new look.
 *
 * Token-key convention: keys are normalized to the `--`-prefixed CSS custom
 * property form here, so the engine accepts both the bare keys the bundled
 * built-in JSON files use (`color-surface-base`) and the `--`-prefixed keys
 * the generator / import path produce (`--color-surface-base`). The
 * `data-theme-applied` bookkeeping always stores the normalized form so
 * teardown matches what was written.
 *
 * Why inline CSS variables instead of regenerated stylesheets? No layout
 * thrash, themes override only the tokens they care about (everything else
 * falls back to the `@theme` defaults in tokens.css), and the Light/Dark/Auto
 * toggle's `data-theme` attribute cooperates without conflict.
 */

const APPLIED_KEYS_ATTR = "data-theme-applied";
/** Separate bookkeeping for live PREVIEW overrides (Theme Studio, A2a). Kept
 *  distinct from `data-theme-applied` so a committed theme apply and an ephemeral
 *  preview never clobber each other's teardown set. Never persisted. */
const PREVIEW_KEYS_ATTR = "data-theme-preview-applied";

/** Ensure a token key is in `--name` form. Idempotent. */
function cssVarName(key: string): string {
  return key.startsWith("--") ? key : `--${key}`;
}

/**
 * Apply a theme to the document root.
 *
 *   1. Clear any variables a previous theme wrote (via the attribute).
 *   2. Write each `theme.tokens` entry as a `--`-prefixed inline property.
 *   3. Set the three identity attributes so dependent CSS scopes update.
 *
 * Safe to call repeatedly with the same theme.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  clearPreviousKeys(root);

  const keys: string[] = [];
  for (const [rawKey, value] of Object.entries(theme.tokens)) {
    const key = cssVarName(rawKey);
    root.style.setProperty(key, value);
    keys.push(key);
  }
  root.setAttribute(APPLIED_KEYS_ATTR, JSON.stringify(keys));
  // A real theme apply supersedes any live preview overlay: drop preview keys
  // this committed set now owns, so a later `clearTokenOverrides` can't strip
  // the committed value (Theme Studio commit ordering, §3e).
  reconcilePreviewAfterCommit(root, new Set(keys));

  root.setAttribute("data-theme-id", theme.id);
  root.setAttribute("data-theme", theme.mode);
  root.setAttribute("data-density", theme.density);
}

/**
 * Live PREVIEW apply (Theme Studio, A2a). Writes a sparse map of token overrides
 * onto an **explicit** root (never ambient `document` — see {@link APP_ROOT}),
 * additively: previously-written preview keys are retained in the tracking set so
 * a later {@link clearTokenOverrides} removes exactly the preview overlay without
 * disturbing the committed theme underneath. Idempotent per key.
 */
export function applyTokenOverrides(overrides: Record<string, string>, root: HTMLElement): void {
  const tracked = new Set(readKeyList(root, PREVIEW_KEYS_ATTR));
  for (const [rawKey, value] of Object.entries(overrides)) {
    const key = cssVarName(rawKey);
    root.style.setProperty(key, value);
    tracked.add(key);
  }
  root.setAttribute(PREVIEW_KEYS_ATTR, JSON.stringify([...tracked]));
}

/**
 * Remove the live preview overlay from a root. `except` keeps a set of keys
 * inline (the no-flash commit/cancel ordering re-asserts the committed theme
 * first, then clears only the preview-only keys it does NOT own — §3e), so there
 * is never a frame where the root has neither value.
 */
export function clearTokenOverrides(root: HTMLElement, except?: Set<string>): void {
  const tracked = readKeyList(root, PREVIEW_KEYS_ATTR);
  const kept: string[] = [];
  for (const key of tracked) {
    if (except?.has(key)) {
      kept.push(key);
      continue;
    }
    root.style.removeProperty(key);
  }
  if (kept.length > 0) root.setAttribute(PREVIEW_KEYS_ATTR, JSON.stringify(kept));
  else root.removeAttribute(PREVIEW_KEYS_ATTR);
}

/** Drop committed keys from the preview tracking set (they're now owned by the
 *  committed theme), leaving any preview-only keys for a later clear. */
function reconcilePreviewAfterCommit(root: HTMLElement, committed: Set<string>): void {
  const tracked = readKeyList(root, PREVIEW_KEYS_ATTR);
  if (tracked.length === 0) return;
  const remaining = tracked.filter((k) => !committed.has(k));
  if (remaining.length > 0) root.setAttribute(PREVIEW_KEYS_ATTR, JSON.stringify(remaining));
  else root.removeAttribute(PREVIEW_KEYS_ATTR);
}

/**
 * Remove every variable a previously-applied theme wrote and clear the
 * identity attributes. Does NOT touch `data-theme` (owned by `useTheme`).
 */
export function clearTheme(): void {
  const root = document.documentElement;
  clearPreviousKeys(root);
  root.removeAttribute("data-theme-id");
  root.removeAttribute("data-density");
}

function clearPreviousKeys(root: HTMLElement): void {
  for (const key of readKeyList(root, APPLIED_KEYS_ATTR)) {
    root.style.removeProperty(key);
  }
  root.removeAttribute(APPLIED_KEYS_ATTR);
}

/** Parse a JSON string-array key-tracking attribute into normalized var names.
 *  A corrupt attribute yields `[]` — nothing safe to clean. */
function readKeyList(root: HTMLElement, attr: string): string[] {
  const raw = root.getAttribute(attr);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr)
      ? arr.filter((k): k is string => typeof k === "string").map(cssVarName)
      : [];
  } catch {
    return [];
  }
}
