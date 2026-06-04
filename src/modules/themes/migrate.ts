/**
 * Theme v1 → v2 migration transform (Track A data-model v2, the reconciling
 * keystone).
 *
 * A v1 {@link Theme} record is a fully-resolved token bag with an optional, lossy
 * {@link ThemeGenerationMeta} block. v2 splits that into a discriminated `base`
 * (re-derivable generation input, or frozen static tokens), a sparse `overrides`
 * map, and a mandatory write-through `tokens` cache (§3a/§3h).
 *
 * The single most important property (Open Decision 2): the upgrade is
 * **pixel-identical**. The `tokens` cache is set to the stored tokens verbatim,
 * so an upgraded theme renders byte-for-byte as it did before. For a re-derivable
 * theme, `overrides` is the **diff** between the stored tokens and a fresh
 * `generateTheme(input)` run, so a later re-edit reproduces exactly what the user
 * saw (and adopts additive engine richness via the base — §3i).
 *
 * Reconciliation note (A1b shipped ahead of A1a.5): a v1 generated theme may
 * carry `generation.statusOverrides`. Those are folded into `base.input.statusOverrides`
 * here, idempotently, with no family dropped — this is the A1b migration debt the
 * keystone now owns.
 *
 * Robustness: a legacy generation block with an unparseable color makes
 * `generateTheme` throw. We catch and fall back to a `static` base that freezes
 * the stored tokens — the theme keeps its appearance and is simply no longer
 * re-derivable (correct, since its input can't be re-run). Callers wrapping
 * untrusted data (the DB upgrade) additionally guard each record so one bad
 * record never aborts the whole upgrade.
 */

import {
  type GenerationInputV2,
  type StatusOverrides,
  type Theme,
  type ThemeBase,
  type ThemeDensity,
  type ThemeId,
  type ThemeMode,
  type ThemeSource,
  type ThemeTokens,
} from "@/types/theme";

import { generateTheme, STATUS_HUES } from "./generate";
import { deriveGenerationMeta, toGenInput } from "./resolve";

/** The legacy (pre-v2) persisted/portable theme record shape. */
export interface ThemeV1Record {
  id: ThemeId;
  name: string;
  description: string;
  author: string;
  source: ThemeSource;
  mode: ThemeMode;
  density: ThemeDensity;
  tokens: ThemeTokens;
  generation?: {
    schemaVersion?: number;
    baseColor: string;
    accentColor: string;
    contrast: number;
    paired?: ThemeId;
    statusOverrides?: StatusOverrides;
  };
  createdAt: number;
  updatedAt: number;
}

/** A record that may be either a v1 or an already-migrated v2 theme. */
export type MigratableTheme = Theme | ThemeV1Record;

/** True once a record carries the v2 discriminated `base`. */
export function isV2Theme(record: MigratableTheme): record is Theme {
  const base = (record as { base?: unknown }).base;
  return typeof base === "object" && base !== null;
}

/** A generation block is usable iff it carries the three required engine inputs. */
function hasGenerationInput(
  g: ThemeV1Record["generation"],
): g is NonNullable<ThemeV1Record["generation"]> {
  return (
    !!g &&
    typeof g.baseColor === "string" &&
    typeof g.accentColor === "string" &&
    typeof g.contrast === "number"
  );
}

/** Capture stored token entries that differ from (or are absent in) the generated set. */
function diffTokens(stored: ThemeTokens, generated: ThemeTokens): ThemeTokens {
  const out: ThemeTokens = {};
  for (const [key, value] of Object.entries(stored)) {
    if (generated[key] !== value) out[key] = value;
  }
  return out;
}

/**
 * Migrate one theme record to v2. Idempotent: an already-v2 record is returned
 * unchanged. Never throws on a bad generation block — falls back to `static`.
 */
export function migrateThemeV1ToV2(record: MigratableTheme): Theme {
  if (isV2Theme(record)) return record;

  const v1 = record;
  const common = {
    id: v1.id,
    name: v1.name,
    description: v1.description,
    author: v1.author,
    source: v1.source,
    mode: v1.mode,
    density: v1.density,
    createdAt: v1.createdAt,
    updatedAt: v1.updatedAt,
  };

  // Re-derivable path: a usable generation block → generated base + diff-overrides.
  if (hasGenerationInput(v1.generation)) {
    const g = v1.generation;
    const input: GenerationInputV2 = {
      schemaVersion: 2,
      baseColor: g.baseColor,
      accentColor: g.accentColor,
      contrast: g.contrast,
      mode: v1.mode,
      density: v1.density,
      // Pin the status hues so the input is self-describing and survives a future
      // engine default change (§3i). Status OVERRIDES (A1b) fold in below.
      statusHues: { ...STATUS_HUES },
    };
    // fontFamily was lost in v1 — reconstruct it only if the stored tokens carry
    // an explicit font, else leave it undefined to keep the input honest (§3i).
    if (typeof v1.tokens["--font-family-body"] === "string") {
      input.fontFamily = v1.tokens["--font-family-body"];
    }
    // A1b migration debt: carry the already-shipped per-family overrides verbatim.
    if (g.statusOverrides !== undefined) input.statusOverrides = g.statusOverrides;

    let base: ThemeBase;
    let overrides: ThemeTokens;
    try {
      const generated = generateTheme(toGenInput(input, v1.name)).tokens;
      overrides = diffTokens(v1.tokens, generated);
      base = { kind: "generated", input };
    } catch (err) {
      // Unparseable legacy color — freeze the rendered look; no longer derivable.
      console.warn(`[theme-migrate] theme ${v1.id}: generation failed, frozen as static.`, err);
      base = { kind: "static", tokens: v1.tokens };
      overrides = {};
    }

    const migrated: Theme = {
      ...common,
      base,
      overrides,
      tokens: v1.tokens, // pixel-identical upgrade
      ...(g.paired !== undefined ? { paired: g.paired } : {}),
    };
    const generation = deriveGenerationMeta(migrated);
    return generation ? { ...migrated, generation } : migrated;
  }

  // Frozen path: built-in-shaped / imported / hand-authored — preserved verbatim.
  return {
    ...common,
    base: { kind: "static", tokens: v1.tokens },
    overrides: {},
    tokens: v1.tokens,
  };
}
