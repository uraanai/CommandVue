import type { Theme } from "@/types/theme";

/**
 * Theme application engine (Phase 3.3).
 *
 * Writes a theme's token overrides onto `:root` as inline CSS variables and
 * sets the three identity attributes (`data-theme-id`, `data-theme`,
 * `data-density`). Cleans up cleanly when another theme is applied — without
 * tracking which keys came from the previous theme, switching themes would
 * leave stale variables behind that bleed into the new look.
 *
 * The state is tracked via `data-theme-applied` on `<html>` — a JSON-encoded
 * list of the keys the current theme set. The next call reads + clears that
 * list before writing its own.
 *
 * Why inline CSS variables instead of regenerated stylesheets?
 *   - No layout thrash (no `<style>` injection / removal)
 *   - Themes can override only the tokens they care about; everything else
 *     falls back to the `@theme` defaults in tokens.css naturally
 *   - The Light/Dark/Auto toggle's `data-theme` attribute and the theme
 *     application engine cooperate without conflict — the toggle owns the
 *     attribute, the engine owns the variable overrides
 */

const APPLIED_KEYS_ATTR = "data-theme-applied";

/**
 * Apply a theme to the document root.
 *
 *   1. Clear any variables a previous theme wrote (via the attribute).
 *   2. Write each `theme.tokens` entry as `style.setProperty('--<key>', value)`.
 *   3. Set the three identity attributes — `data-theme-id`, `data-theme`,
 *      `data-density` — so CSS scopes that depend on them (the dark-mode
 *      cascade, density tokens, theme-keyed component styles) update.
 *
 * Safe to call repeatedly with the same theme — the cleanup step ensures
 * stale keys are removed first.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  // 1. Tear down any keys the previous theme set.
  clearPreviousKeys(root);

  // 2. Write this theme's overrides.
  const keys: string[] = [];
  for (const [key, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--${key}`, value);
    keys.push(key);
  }
  root.setAttribute(APPLIED_KEYS_ATTR, JSON.stringify(keys));

  // 3. Identity attributes. Other systems (the dark-mode cascade,
  //    `[data-density]` overrides in tokens.css) react to these.
  root.setAttribute("data-theme-id", theme.id);
  root.setAttribute("data-theme", theme.mode);
  root.setAttribute("data-density", theme.density);
}

/**
 * Remove every variable a previously-applied theme wrote and clear the
 * identity attributes. Useful for "reset to defaults" flows and tests.
 *
 * Does NOT touch `data-theme` (the light/dark resolved mode) — that's owned
 * by `useTheme()`. Theme application sets it on apply; clearing leaves
 * whatever value was last applied so the dark mode token cascade stays
 * sane.
 */
export function clearTheme(): void {
  const root = document.documentElement;
  clearPreviousKeys(root);
  root.removeAttribute("data-theme-id");
  // Leave `data-theme` (owned by useTheme) alone.
  root.removeAttribute("data-density");
}

function clearPreviousKeys(root: HTMLElement): void {
  const raw = root.getAttribute(APPLIED_KEYS_ATTR);
  if (!raw) return;
  try {
    const prev = JSON.parse(raw) as unknown;
    if (Array.isArray(prev)) {
      for (const k of prev) {
        if (typeof k === "string") root.style.removeProperty(`--${k}`);
      }
    }
  } catch {
    // Corrupt attribute — nothing safe to clean. Drop it and move on.
  }
  root.removeAttribute(APPLIED_KEYS_ATTR);
}
