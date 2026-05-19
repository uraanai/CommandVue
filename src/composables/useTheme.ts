import { useDark, useToggle } from "@vueuse/core";

const STORAGE_KEY = "commandvue:theme";

/**
 * Theme composable.
 *
 * Resolves the theme in priority order:
 *   1. Explicit user choice (persisted under `commandvue:theme`).
 *   2. `prefers-color-scheme` media query.
 *   3. Light fallback.
 *
 * Sets `data-theme="dark"` or `data-theme="light"` on `<html>`. The `dark:`
 * Tailwind variant (configured in `main.css` via `@custom-variant`) and the
 * `html[data-theme="dark"]` runtime overrides in `tokens.css` both key off
 * this attribute, so the same toggle drives utility classes and CSS vars.
 *
 * Phase 4 may migrate persistence from localStorage to idb for consistency
 * with `useLayout`. Until then, localStorage is sufficient (sync, universal,
 * survives reloads).
 */
export function useTheme() {
  const isDark = useDark({
    storageKey: STORAGE_KEY,
    selector: "html",
    attribute: "data-theme",
    valueDark: "dark",
    valueLight: "light",
  });

  const toggle = useToggle(isDark);

  return { isDark, toggle };
}
