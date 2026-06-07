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
export const THEME_SCHEMA_VERSION = 2 as const;
export type ThemeSchemaVersion = typeof THEME_SCHEMA_VERSION;

/**
 * Bumped only when `generateTheme`'s **derivation math** changes (not when keys
 * are added — those are additive, see the §3i engine-stability contract). The
 * `resolve()` memo is keyed on this, so a stale generated-base cache is never
 * served across a math change. Independent of {@link THEME_SCHEMA_VERSION},
 * which versions the persisted record shape.
 */
export const ENGINE_VERSION = 1 as const;
export type EngineVersion = typeof ENGINE_VERSION;

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

/** The four semantic status families. Each anchors a fixed hue by default. */
export type StatusFamily = "success" | "warning" | "danger" | "info";

/**
 * Per-family status override (Track A A1b/A2b).
 *
 * - **Tier 1 (hue-only, A1b):** set `hue` to re-point just the family hue; the
 *   engine keeps the mode-tuned lightness/chroma so the result stays in-gamut,
 *   mode-adaptive, and AA-safe, and the subtle fill auto-derives.
 * - **Tier 2 (explicit, A2b):** `color` / `subtle` pin exact values; `color`
 *   takes precedence over `hue`. Carried in the type now so persisted themes
 *   round-trip, but only `hue` is consumed by the generator until A2b.
 */
export interface StatusFamilyOverride {
  /** 0–360. Re-points the family hue (Tier 1). */
  hue?: number;
  /** Explicit color, normalized through the engine (Tier 2 — A2b). */
  color?: string;
  /** Explicit subtle fill (Tier 2 — A2b). */
  subtle?: string;
}

/** Optional per-family status overrides. Absent families take engine defaults. */
export type StatusOverrides = Partial<Record<StatusFamily, StatusFamilyOverride>>;

/**
 * Per-family status hue pins. Pinned to the engine's `STATUS_HUES` constants on
 * migration so a generated theme's hues are self-describing in `base.input` and
 * survive a future engine default change (§3i). The live hue lever today is
 * {@link StatusFamilyOverride.hue} via {@link StatusOverrides}; the generator
 * does not yet consume `statusHues` (forward-compat field).
 */
export interface StatusHues {
  success?: number;
  warning?: number;
  danger?: number;
  info?: number;
}

/** Provenance of a font-family choice (Track A C3). */
export type FontSource = "google" | "system" | "stack";

/**
 * A structured font choice (Track A C3). Persisted on a generated theme's
 * `base.input` and carried in the portable export JSON so a re-import re-loads
 * the same Google font. Lossless superset of the legacy `fontFamily` string.
 *
 * In C3 `fontSpec` is GOOGLE-ONLY: it is set only when the author picks a Google
 * family. The curated quick-stack `<Select>` keeps writing the legacy
 * `fontFamily` string (see plan §0.4). The optional `heading` sub-shape is
 * carried for forward-compat + round-trip but is NOT consumed by C3's engine
 * emit or UI — `--font-family-heading` is owned by C2 (Typography).
 */
export interface FontSpec {
  /** Catalog display name (e.g. "Inter", "IBM Plex Sans"). Charset-allowlisted. */
  family: string;
  source: FontSource;
  /** Upright weights to request from Google. Empty/omitted → loader requests 400. */
  weights?: number[];
  /** Fallback stack appended after `family` (e.g. "system-ui, sans-serif"). */
  fallback?: string;
  /** Forward-compat heading role (consumed by C2, not C3). */
  heading?: { family: string; source: FontSource; weights?: number[]; fallback?: string };
}

/** Inputs to the modular type-scale deriver (Track A C2). */
export interface TypeScaleInput {
  /** Base font size in px for the `--text-base` step. Range 10–24 (out-of-range rejected by Zod, not clamped). */
  baseSize: number;
  /** Modular ratio (e.g. 1.2 = minor third). Range 1.0–1.333 (out-of-range rejected by Zod, not clamped). */
  ratio: number;
}

/**
 * Depth / glow / blur effect inputs (Track A C5). All optional; OMITTED when
 * unset to keep the input honest (§3i) and the resolve memo key stable. Drives
 * the elevation ramp, accent-glow strength, and panel blur radius. Absent → the
 * engine emits NO effect tokens and the tokens.css static defaults apply
 * (byte-identical output).
 */
export interface EffectsSpec {
  /** 0–100. Depth of the --shadow-1..5 elevation ramp. 0 = flat (no shadow),
   *  50 = neutral default (~ tokens.css baseline), 100 = dramatic. */
  depth?: number;
  /** 0–1. Alpha of --color-interactive-glow (re-points the glow color only). */
  glowAlpha?: number;
  /** 0–24 (px). Radius for --dockpanel-glass-blur (consumed by C4 glass panels). */
  blurRadius?: number;
}

/**
 * Inputs to the generation engine, persisted as a generated theme's `base`
 * (Track A data-model v2). Unlike the legacy {@link ThemeGenerationMeta}, this
 * is **lossless**: it carries `fontFamily` and the status hue/override inputs so
 * a generated theme is fully re-derivable from `base.input` alone.
 */
export interface GenerationInputV2 {
  schemaVersion: 2;
  /** Any CSS color; normalized to OKLCH. Drives surface hue + tint. */
  baseColor: string;
  /** Any CSS color; normalized to OKLCH. Drives the interactive scale. */
  accentColor: string;
  /** 30–100. Higher → larger text/surface contrast. */
  contrast: number;
  mode: ThemeMode;
  density: ThemeDensity;
  /** Font stack; OMITTED (not defaulted) when unset, to keep the input honest (§3i). */
  fontFamily?: string;
  /** Per-family hue pins (forward-compat; see {@link StatusHues}). */
  statusHues?: StatusHues;
  /** Per-family status overrides (A1b live hue lever). */
  statusOverrides?: StatusOverrides;
  /**
   * Modular type-scale generator input (Track A C2). When present the engine
   * derives the `--text-xs … --text-4xl` ramp AND their `--text-*--line-height`
   * companions via baseSize × ratio^step; when absent the fixed tokens.css ramp
   * is the cascade fallback (additive — §3i). Per-step tweaks live in `overrides`.
   */
  typeScale?: TypeScaleInput;
  /**
   * Structured font choice (C3). When present it is the source of truth; the
   * engine derives `fontFamily` from `fontSpec` so the legacy token-emit path
   * stays identical. `fontFamily` is retained for back-compat (pre-C3 themes and
   * the System/quick-stack picks that never needed a fontSpec).
   */
  fontSpec?: FontSpec;
  /** Depth / glow / blur effect inputs (Track A C5). Additive, optional. */
  effects?: EffectsSpec;
}

/**
 * Discriminated theme base (data-model v2).
 *   - `generated` — re-derivable from a {@link GenerationInputV2} via the engine.
 *   - `static`    — frozen tokens that are NOT derivable (the six built-ins, which
 *     reference hand-tuned `var(--color-slate-*)` primitives, and hand-authored
 *     imports). Preserved byte-for-byte.
 */
export type ThemeBase =
  | { kind: "generated"; input: GenerationInputV2 }
  | { kind: "static"; tokens: ThemeTokens };

/**
 * Legacy generation metadata. In data-model v2 this is **no longer the source of
 * truth** — generated themes carry their inputs in {@link ThemeBase} (`base.input`)
 * and their pairing in {@link Theme.paired}. This block is kept as a
 * **derived write-through cache** on the runtime `Theme` so the transitional UI
 * consumers (customizer / picker / menu / workspace-switcher) keep reading
 * `theme.generation.*` unchanged until they are rewritten as the Theme Studio
 * panel (A2a). Populated from `base.input`+`paired` on every repo write.
 *
 * @deprecated Read `base.input` / `paired` instead. Removed in A2a.
 */
export interface ThemeGenerationMeta {
  schemaVersion: 1;
  baseColor: string; // OKLCH string, e.g. "oklch(0.15 0.04 270)"
  accentColor: string;
  contrast: number; // 30-100
  paired?: ThemeId; // mirror of Theme.paired, for the transition
  /** Per-family status hue/color overrides (Track A A1b). Absent → defaults. */
  statusOverrides?: StatusOverrides;
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
  /**
   * Discriminated base (v2): a re-derivable generation input, or frozen static
   * tokens. The source of truth for what the theme *is*.
   */
  readonly base: ThemeBase;
  /**
   * Sparse, hand-edited token overrides (A2b). Layered over the resolved base
   * with CSS-cascade semantics (override wins). `{}` for fresh-generated and
   * built-in themes.
   */
  readonly overrides: ThemeTokens;
  /**
   * MANDATORY resolved cache (write-through): `resolve(base) ⊕ overrides`.
   * Always populated on create/update. Load-bearing for anti-FOUC first paint —
   * the boot path reads this cache, never `resolve()` (§3h). Consumers
   * (`apply.ts`, `export.ts`, pop-out mirroring, swatch sampling) keep reading
   * `theme.tokens` through the v2 transition.
   */
  readonly tokens: ThemeTokens;
  /** Id of the paired light/dark variant, if any. Moved off `generation` (v2). */
  readonly paired?: ThemeId;
  /**
   * Derived write-through cache of `base.input`+`paired` (generated themes only).
   * @deprecated Not source of truth — read `base.input` / `paired`. Removed in A2a.
   */
  readonly generation?: ThemeGenerationMeta;
  /** Unix ms timestamp. Aligns with the rest of the storage layer. */
  readonly createdAt: number;
  /** Unix ms timestamp; updated on every save. */
  readonly updatedAt: number;
}

/**
 * Shape of the bundled JSON files under `src/assets/themes/`. The JSONs carry
 * only the authored fields (`id`/`name`/`description`/`author`/`mode`/`density`/
 * `tokens`); `source`, timestamps, and the v2 `base`/`overrides`/cache are
 * synthesized at load time (`builtin.ts`). Token keys in these files omit the
 * leading `--` (historical); the loader normalizes them.
 */
export type ThemeDefinition = Omit<
  Theme,
  "source" | "createdAt" | "updatedAt" | "generation" | "base" | "overrides" | "paired"
>;

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
