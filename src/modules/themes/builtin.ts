import type { Theme, ThemeDefinition } from "@/types/theme";

import adminPanelDark from "@/assets/themes/admin-panel-dark.json";
import adminPanelLight from "@/assets/themes/admin-panel-light.json";
import commandCenterDark from "@/assets/themes/command-center-dark.json";
import commandCenterLight from "@/assets/themes/command-center-light.json";
import compactDark from "@/assets/themes/compact-dark.json";
import compactLight from "@/assets/themes/compact-light.json";

import { themeRegistry } from "./registry";

/**
 * The six built-in theme variants shipped with CommandVue.
 *
 * Pairing convention: every entry comes with both a `-light` and `-dark`
 * variant sharing the same base id. The Light/Dark/Auto toggle uses the
 * suffix swap to switch between paired variants without losing the chosen
 * aesthetic.
 *
 * Adding a new built-in:
 *   1. Drop the JSON file under `src/assets/themes/`.
 *   2. Import + add it to `BUILTIN_THEMES` below.
 *   3. Re-capture the relevant `docs/concepts.md` screenshots if the new
 *      theme becomes the documentation default (see
 *      `docs/public/concepts/MANIFEST.md`).
 */
const BUILTIN_DEFINITIONS: readonly ThemeDefinition[] = [
  compactLight as ThemeDefinition,
  compactDark as ThemeDefinition,
  commandCenterLight as ThemeDefinition,
  commandCenterDark as ThemeDefinition,
  adminPanelLight as ThemeDefinition,
  adminPanelDark as ThemeDefinition,
];

let registered = false;

/** Normalize bundled token keys to the `--`-prefixed form the engine + repo use. */
function normalizeTokens(tokens: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    out[key.startsWith("--") ? key : `--${key}`] = value;
  }
  return out;
}

/**
 * Hydrate the bundled JSON files into the runtime `Theme` shape (sets
 * `source: "built-in"`, fills timestamps, normalizes token keys) and register
 * each with `themeRegistry`. Idempotent — second call is a no-op.
 */
export function registerBuiltinThemes(): void {
  if (registered) return;
  const now = Date.now();
  for (const def of BUILTIN_DEFINITIONS) {
    const theme: Theme = {
      ...def,
      tokens: normalizeTokens(def.tokens),
      source: "built-in",
      createdAt: now,
      updatedAt: now,
    };
    themeRegistry.register(theme);
  }
  registered = true;
}

/** Test-only — reset the registry and the `registered` flag together. */
export function __unregisterBuiltinThemesForTests(): void {
  themeRegistry.__resetForTests();
  registered = false;
}
