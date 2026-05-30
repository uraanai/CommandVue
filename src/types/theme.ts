/**
 * Theme types.
 *
 * A `Theme` is a named bundle of CSS-variable overrides applied to the
 * document root at runtime. Built-in themes ship as JSON files under
 * `src/assets/themes/`; custom themes (Prompt 4) live in IndexedDB via
 * `themeRepo` and are registered into `themeRegistry` at boot.
 *
 * Pairing convention: themes that come in light + dark pairs share a base id
 * with a `-light` / `-dark` suffix (e.g. `compact-light` and `compact-dark`)
 * for built-ins, or point at each other via `generation.paired` for
 * generated themes. The Light / Dark / Auto toggle uses either signal to
 * bridge between variants without losing the chosen aesthetic.
 *
 * Tokens layered into the document live in three categories — color, density,
 * and component. Themes **only** override semantic + component tokens.
 * Primitive scales (`--color-slate-500`, `--space-4`, etc.) are off-limits;
 * `docs/design-tokens.md` covers the rationale.
 */

/** Bumped when the persisted/portable theme shape changes incompatibly. */
export const THEME_SCHEMA_VERSION = 1 as const;
export type ThemeSchemaVersion = typeof THEME_SCHEMA_VERSION;

export type ThemeId = string;
export type ThemeMode = "light" | "dark";
export type ThemeDensity = "compact" | "comfortable" | "spacious";

/**
 * Where a theme came from.
 *   - `built-in`  — one of the six bundled JSON variants; registered, never
 *     stored in `themeRepo`.
 *   - `user`      — hand-authored by the user (reserved; the editor produces
 *     `generated` today).
 *   - `imported`  — created by importing a PortableTheme JSON file.
 *   - `generated` — produced by the Linear-style generation engine.
 */
export type ThemeSource = "built-in" | "user" | "imported" | "generated";

/**
 * The dictionary of CSS-variable overrides. Each key is a CSS custom property
 * name *including* the leading `--` (e.g. `--color-surface-base`). Values are
 * plain CSS values (`#1e293b`, `oklch(0.2 0.04 264)`, `1.75rem`, …).
 *
 * Note: the bundled built-in JSON files predate this convention and store keys
 * *without* the leading `--`; the loader in `builtin.ts` normalizes them.
 * New code (repo, generator, import) uses the `--`-prefixed form throughout.
 */
export type ThemeTokens = Record<string, string>;

/**
 * Generation parameters captured when a theme is produced by the engine.
 * Present iff `source === "generated"`. Lets the editor pre-fill its inputs
 * when editing a generated theme, and lets the toggle find the paired variant.
 */
export interface ThemeGenerationMeta {
  schemaVersion: 1;
  baseColor: string; // OKLCH string, e.g. "oklch(0.15 0.04 270)"
  accentColor: string;
  contrast: number; // 30-100
  paired?: ThemeId; // id of the paired light/dark variant, if generated as a pair
}

export interface Theme {
  /** Stable id used by the registry, the store, and the persisted pointer. */
  readonly id: ThemeId;
  /** Human-readable name shown in the picker. */
  readonly name: string;
  /** One-paragraph description shown in the picker. */
  readonly description: string;
  /** Free-form attribution shown on the card footer. */
  readonly author: string;
  /** Provenance of the theme. */
  readonly source: ThemeSource;
  /** Intrinsic mode — used to bridge between light/dark variants. */
  readonly mode: ThemeMode;
  /** Default density applied with the theme. */
  readonly density: ThemeDensity;
  /** CSS-variable overrides. See `ThemeTokens`. */
  readonly tokens: ThemeTokens;
  /** Generation parameters; present iff `source === "generated"`. */
  readonly generation?: ThemeGenerationMeta;
  /** Unix ms timestamp. Aligns with the rest of the storage layer. */
  readonly createdAt: number;
  /** Unix ms timestamp; updated on every save. */
  readonly updatedAt: number;
}

/**
 * Shape of the bundled JSON files under `src/assets/themes/`. Same as `Theme`
 * minus the runtime-derived fields — `source` is forced to `built-in` and the
 * timestamps are filled at load time. Token keys in these files omit the
 * leading `--` (historical); the loader normalizes them.
 */
export type ThemeDefinition = Omit<Theme, "source" | "createdAt" | "updatedAt" | "generation">;

/**
 * Export/import envelope. Wraps a single `Theme` with provenance metadata so
 * importers can validate the schema version and surface where the file came
 * from. Produced by `exportThemeToJson` (Phase D), consumed by
 * `importThemeFromJson` (Phase D).
 */
export interface PortableTheme {
  schemaVersion: ThemeSchemaVersion;
  exportedAt: number;
  exportedBy: "commandvue";
  exportedByVersion: string;
  theme: Theme;
}

/**
 * Subset of theme tokens the picker preview samples for its swatch chips.
 */
export interface ThemeSwatches {
  surface: string;
  surfaceRaised: string;
  text: string;
  interactive: string;
  success: string;
  danger: string;
}
