/**
 * Theme `resolve()` materializer (Track A data-model v2).
 *
 * A v2 {@link Theme} stores what it *is* (`base`) and what the user *changed*
 * (`overrides`), not a frozen token bag. `resolve()` materializes the two into
 * the full {@link ThemeTokens} record that the apply engine, exporter, pop-out
 * mirroring, and swatch sampling consume. Generated bases are memoized so the
 * culori gamut loops in `generateTheme` run at most once per distinct input.
 *
 * The resolved record is written through to `Theme.tokens` on every repo write
 * (§3h) — the boot/anti-FOUC path reads that cache, never `resolve()`, because a
 * tiny pre-paint inline script cannot run the engine.
 *
 * Memoization is keyed on `${ENGINE_VERSION}:${JSON.stringify(base.input)}` so a
 * stale base cache is never served across an engine math bump (§3i). The input
 * string includes `statusHues` + `statusOverrides`, so two themes that differ
 * only in a status override do not collide.
 *
 * Note: `resolve()` on a `generated` base calls `generateTheme`, which throws on
 * an unparseable color. Callers that handle legacy/untrusted data (the IndexedDB
 * migration, the import upcast) wrap the call in try/catch and fall back to a
 * `static` base; the runtime create/update path only ever resolves
 * engine-validated inputs, so it lets a throw propagate.
 */

import {
  ENGINE_VERSION,
  type GenerationInputV2,
  type Theme,
  type ThemeBase,
  type ThemeGenerationMeta,
  type ThemeTokens,
} from "@/types/theme";

import { generateTheme, type ThemeGenerationInput } from "./generate";

/** base-tokens cache, keyed on `${ENGINE_VERSION}:${JSON.stringify(input)}`. */
const baseCache = new Map<string, ThemeTokens>();

/**
 * Map a persisted {@link GenerationInputV2} to the engine's
 * {@link ThemeGenerationInput}. `name` is supplied by the caller (the engine
 * requires it but it does not affect token output). `statusHues` is intentionally
 * dropped — the engine does not consume it yet (forward-compat field); the live
 * hue lever is `statusOverrides[family].hue` (A1b).
 */
export function toGenInput(input: GenerationInputV2, name: string): ThemeGenerationInput {
  const out: ThemeGenerationInput = {
    baseColor: input.baseColor,
    accentColor: input.accentColor,
    contrast: input.contrast,
    mode: input.mode,
    density: input.density,
    name,
  };
  if (input.fontFamily !== undefined) out.fontFamily = input.fontFamily;
  if (input.fontSpec !== undefined) out.fontSpec = input.fontSpec;
  if (input.statusOverrides !== undefined) out.statusOverrides = input.statusOverrides;
  return out;
}

/**
 * Resolve (and memoize) the base tokens for a {@link ThemeBase}. `static` bases
 * return their frozen tokens directly; `generated` bases run the engine once per
 * distinct `${ENGINE_VERSION}:${input}` key and reuse the result. Returns the
 * cached reference — callers must not mutate it (`resolve()` spreads it).
 */
export function resolveBaseTokens(base: ThemeBase, name: string): ThemeTokens {
  if (base.kind === "static") return base.tokens;
  const key = `${ENGINE_VERSION}:${JSON.stringify(base.input)}`;
  const hit = baseCache.get(key);
  if (hit) return hit;
  const tokens = generateTheme(toGenInput(base.input, name)).tokens;
  baseCache.set(key, tokens);
  return tokens;
}

/**
 * Materialize a theme's full token record: resolved base ⊕ sparse overrides,
 * with overrides winning (CSS-cascade semantics). Always returns a fresh object
 * so callers never alias the memo cache.
 */
export function resolve(theme: Pick<Theme, "base" | "overrides" | "name">): ThemeTokens {
  const baseTokens = resolveBaseTokens(theme.base, theme.name);
  const overrides = theme.overrides ?? {};
  return { ...baseTokens, ...overrides };
}

/**
 * Derive the deprecated {@link ThemeGenerationMeta} compat block from a v2 base.
 * Populated as a write-through cache on generated themes so the transitional UI
 * consumers (customizer / picker / menu / workspace-switcher) keep reading
 * `theme.generation.*` until they are rewritten in A2a. `undefined` for static
 * bases (built-ins / hand-authored imports never had a generation block).
 */
export function deriveGenerationMeta(
  theme: Pick<Theme, "base" | "paired">,
): ThemeGenerationMeta | undefined {
  if (theme.base.kind !== "generated") return undefined;
  const { baseColor, accentColor, contrast, statusOverrides } = theme.base.input;
  const meta: ThemeGenerationMeta = { schemaVersion: 1, baseColor, accentColor, contrast };
  if (theme.paired !== undefined) meta.paired = theme.paired;
  if (statusOverrides !== undefined) meta.statusOverrides = statusOverrides;
  return meta;
}

/** Test-only — clear the memoization cache between cases. */
export function __clearResolveCacheForTests(): void {
  baseCache.clear();
}
