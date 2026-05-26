/**
 * Theme types (Phase 3.3 of Prompt 3).
 *
 * A `Theme` is a named bundle of CSS-variable overrides applied to the
 * document root at runtime. Built-in themes ship as JSON files under
 * `src/assets/themes/`; downstream apps register custom themes through
 * `themeRegistry.register()`.
 *
 * Pairing convention: themes that come in light + dark pairs share a base id
 * with a `-light` / `-dark` suffix (e.g. `compact-light` and `compact-dark`).
 * The Light / Dark / Auto toggle uses the suffix to bridge between variants
 * without losing the user's chosen aesthetic.
 *
 * Tokens layered into the document live in three categories:
 *   - color (`--color-surface-*`, `--color-text-*`, `--color-interactive*`, …)
 *   - density-influencing (`--density-*`)
 *   - component (`--datatable-*`, `--dockpanel-*`, …)
 *
 * Themes **only** override semantic + component tokens. Primitive scales
 * (`--color-slate-500`, `--space-4`, etc.) are off-limits — the architecture
 * docs at `docs/design-tokens.md` cover the rationale.
 */

export type ThemeId = string;
export type ThemeMode = "light" | "dark";
export type ThemeDensity = "compact" | "comfortable" | "spacious";

/**
 * The dictionary of CSS-variable overrides. Each key is a CSS custom property
 * name *without* the leading `--`. Values are plain CSS values (`#1e293b`,
 * `var(--color-slate-800)`, `0 1px 2px rgb(0 0 0 / 0.05)`, etc.).
 *
 * Keys are intentionally typed as `string` instead of a closed union so
 * downstream apps can introduce their own component tokens without changing
 * the type. Validation happens at runtime in the application engine.
 */
export type ThemeTokens = Record<string, string>;

export interface Theme {
  /** Stable id used by the registry, the store, and the persisted pointer. */
  readonly id: ThemeId;
  /** Human-readable name shown in the picker. */
  readonly name: string;
  /** One-paragraph description shown in the picker. */
  readonly description: string;
  /** Free-form attribution shown on the card footer. */
  readonly author: string;
  /** `true` for the six bundled variants; `false` for user-authored themes (Prompt 4). */
  readonly isBuiltIn: boolean;
  /**
   * Intrinsic mode of the theme — used by `setMode()` to bridge between
   * light and dark variants of the same base aesthetic.
   */
  readonly mode: ThemeMode;
  /** Default density to apply with the theme. The user can override via the density toggle. */
  readonly density: ThemeDensity;
  /** CSS-variable overrides. See `ThemeTokens`. */
  readonly tokens: ThemeTokens;
  /** ISO timestamp; used for sorting recent custom themes (Prompt 4). */
  readonly createdAt: string;
  /** ISO timestamp; updated on every save (Prompt 4). */
  readonly updatedAt: string;
}

/**
 * Shape of the JSON files under `src/assets/themes/`. Same shape as `Theme`
 * minus the runtime-derived fields; `isBuiltIn` is enforced to `true` and
 * the timestamps are filled in at load time.
 */
export type PortableTheme = Omit<Theme, "isBuiltIn" | "createdAt" | "updatedAt"> & {
  /**
   * Optional explicit timestamps. Built-in JSON files don't set them; the
   * loader fills both with the app boot time.
   */
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Subset of theme tokens the picker preview pulls swatches from. Used by the
 * theme picker dialog to render the "what does this theme look like" chips
 * without applying the theme to the live DOM.
 */
export interface ThemeSwatches {
  surface: string;
  surfaceRaised: string;
  text: string;
  interactive: string;
  success: string;
  danger: string;
}
