import type { PortableTheme, Theme } from "@/types/theme";

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
const BUILTIN_PORTABLE: readonly PortableTheme[] = [
  compactLight as PortableTheme,
  compactDark as PortableTheme,
  commandCenterLight as PortableTheme,
  commandCenterDark as PortableTheme,
  adminPanelLight as PortableTheme,
  adminPanelDark as PortableTheme,
];

let registered = false;

/**
 * Hydrate the bundled JSON files into the runtime `Theme` shape (adds
 * `isBuiltIn: true`, fills timestamps if missing) and register each with
 * `themeRegistry`. Idempotent — second call is a no-op.
 */
export function registerBuiltinThemes(): void {
  if (registered) return;
  const bootTime = new Date().toISOString();
  for (const portable of BUILTIN_PORTABLE) {
    const theme: Theme = {
      ...portable,
      isBuiltIn: true,
      createdAt: portable.createdAt ?? bootTime,
      updatedAt: portable.updatedAt ?? bootTime,
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
