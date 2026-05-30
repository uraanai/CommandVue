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

  root.setAttribute("data-theme-id", theme.id);
  root.setAttribute("data-theme", theme.mode);
  root.setAttribute("data-density", theme.density);
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
  const raw = root.getAttribute(APPLIED_KEYS_ATTR);
  if (!raw) return;
  try {
    const prev = JSON.parse(raw) as unknown;
    if (Array.isArray(prev)) {
      for (const k of prev) {
        if (typeof k === "string") root.style.removeProperty(cssVarName(k));
      }
    }
  } catch {
    // Corrupt attribute — nothing safe to clean. Drop it and move on.
  }
  root.removeAttribute(APPLIED_KEYS_ATTR);
}
