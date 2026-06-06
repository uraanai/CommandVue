/**
 * Curated color + font choices the Phase E customizer surfaces in its
 * swatch pickers and font dropdown.
 *
 * Two design rules drove these picks:
 *
 *   1. **Engine-friendly.** Base swatches sit near the lightness the engine
 *      clamps surface base to (~0.93–0.98 in light, ~0.14–0.20 in dark);
 *      accent swatches sit in the lightness band the engine's interactive
 *      derivation expects (~0.45–0.62 light, ~0.50–0.62 dark) with chroma in
 *      the legibility window (~0.14–0.20). Users picking from the curated
 *      grid land in the engine's sweet spot — they can still go custom via
 *      the "+" affordance, in which case the engine's clamps + gamut
 *      mapping kick in.
 *
 *   2. **Hue coverage, not brand catalog.** Ten accents span the color
 *      wheel at roughly even intervals (blue → green → red → violet) so
 *      almost any aesthetic intent has a one-click starting point. Base
 *      swatches stay near-neutral with a whisper of tint — the surface is
 *      supposed to recede, not assert.
 *
 * Adding / removing entries here is safe — the picker simply renders
 * whatever is passed in `options`. Keep arrays roughly 8–10 items so the
 * grid stays a single row at typical dialog widths.
 */

import type { StatusFamily } from "@/types/theme";

export interface CuratedSwatch {
  /** Human label surfaced as tooltip + aria-label. */
  label: string;
  /** OKLCH CSS string, e.g. `oklch(0.98 0.005 250)`. */
  value: string;
}

export interface CuratedFont {
  label: string;
  /** Full CSS `font-family` value including fallbacks. */
  value: string;
}

/** Near-neutral surfaces with a whisper of tint. Sit in the light-mode
 *  lightness band the engine clamps `surface-base` to (~0.93–0.98). */
export const BASE_COLOR_SWATCHES: readonly CuratedSwatch[] = [
  { label: "Neutral", value: "oklch(0.98 0 0)" },
  { label: "Cool", value: "oklch(0.98 0.006 250)" },
  { label: "Warm", value: "oklch(0.98 0.006 60)" },
  { label: "Sage", value: "oklch(0.98 0.006 145)" },
  { label: "Lavender", value: "oklch(0.98 0.006 295)" },
  { label: "Slate", value: "oklch(0.97 0.008 230)" },
  { label: "Stone", value: "oklch(0.97 0.008 75)" },
  { label: "Rose", value: "oklch(0.98 0.006 20)" },
  { label: "Mint", value: "oklch(0.98 0.006 170)" },
  { label: "Cream", value: "oklch(0.99 0.005 85)" },
];

/** Vibrant accents at mid lightness + mid-to-high chroma, covering the wheel
 *  at roughly even hue intervals. Sit in the band the engine's interactive
 *  derivation expects (lightness ~0.45–0.62, chroma ~0.14–0.20). */
export const ACCENT_COLOR_SWATCHES: readonly CuratedSwatch[] = [
  { label: "Blue", value: "oklch(0.55 0.18 250)" },
  { label: "Indigo", value: "oklch(0.50 0.19 280)" },
  { label: "Violet", value: "oklch(0.55 0.20 305)" },
  { label: "Pink", value: "oklch(0.60 0.20 5)" },
  { label: "Red", value: "oklch(0.55 0.19 25)" },
  { label: "Orange", value: "oklch(0.60 0.17 45)" },
  { label: "Amber", value: "oklch(0.65 0.16 75)" },
  { label: "Green", value: "oklch(0.55 0.16 145)" },
  { label: "Teal", value: "oklch(0.55 0.13 195)" },
  { label: "Cyan", value: "oklch(0.62 0.13 220)" },
];

/** Curated font stacks. `system-ui` first option keeps the dialog snappy when
 *  the user hasn't loaded any web fonts yet; the rest pick well-known stacks
 *  that downstream apps commonly install. Phase B's generator emits exactly
 *  `--font-family-sans` + `--font-family-body` from this string; the
 *  role-based extension (see docs/theme-generation-algorithm.md → Beyond
 *  colors) lands later. */
export const CURATED_FONTS: readonly CuratedFont[] = [
  { label: "System UI", value: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  { label: "Inter", value: "'Inter', system-ui, sans-serif" },
  { label: "IBM Plex Sans", value: "'IBM Plex Sans', system-ui, sans-serif" },
  { label: "Geist", value: "'Geist', system-ui, sans-serif" },
  // Serif heading stack (Track A C2) — gives the Heading role a non-sans option.
  { label: "Georgia (serif)", value: "Georgia, 'Times New Roman', serif" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: "IBM Plex Mono", value: "'IBM Plex Mono', ui-monospace, monospace" },
];

/** Default starting point used when "Start from Blank" is selected. Values
 *  inlined (rather than indexed off the arrays above) so `noUncheckedIndexedAccess`
 *  doesn't surface the elements as possibly-undefined. Keep these in sync with
 *  the first entry of each array. */
export const BLANK_DEFAULTS = {
  baseColor: "oklch(0.98 0 0)", // Neutral
  accentColor: "oklch(0.55 0.18 250)", // Blue
  contrast: 50,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", // System UI
} as const;

/**
 * Per-family status hue presets surfaced by the customizer's "Status hues" row
 * (Track A A1b — Tier 1, hue-only). Each family offers a handful of hues that
 * stay inside its semantic meaning (you can shift "danger" red→rose→orange, but
 * not make it green). `hue` is what the generator consumes; `value` is the
 * representative swatch the picker renders.
 *
 * INVARIANT: the FIRST entry of each family is the default — its `hue` MUST
 * equal the generator's `STATUS_HUES` (success 145, warning 75, danger 27, info
 * 250). Selecting it clears the override (byte-identical output).
 */
export interface StatusHueSwatch {
  label: string;
  /** 0–360 hue fed to the generator as `statusOverrides[family].hue`. */
  hue: number;
  /** Representative OKLCH swatch rendered in the picker. */
  value: string;
}

export const STATUS_HUE_SWATCHES: Record<StatusFamily, readonly StatusHueSwatch[]> = {
  success: [
    { label: "Green (default)", hue: 145, value: "oklch(0.60 0.16 145)" },
    { label: "Emerald", hue: 162, value: "oklch(0.60 0.15 162)" },
    { label: "Teal", hue: 180, value: "oklch(0.60 0.12 180)" },
    { label: "Lime", hue: 128, value: "oklch(0.62 0.16 128)" },
  ],
  warning: [
    { label: "Amber (default)", hue: 75, value: "oklch(0.70 0.16 75)" },
    { label: "Orange", hue: 55, value: "oklch(0.67 0.17 55)" },
    { label: "Yellow", hue: 95, value: "oklch(0.74 0.15 95)" },
    { label: "Gold", hue: 85, value: "oklch(0.72 0.16 85)" },
  ],
  danger: [
    { label: "Red (default)", hue: 27, value: "oklch(0.58 0.20 27)" },
    { label: "Rose", hue: 12, value: "oklch(0.58 0.20 12)" },
    { label: "Crimson", hue: 8, value: "oklch(0.55 0.21 8)" },
    { label: "Orange-red", hue: 38, value: "oklch(0.61 0.18 38)" },
  ],
  info: [
    { label: "Blue (default)", hue: 250, value: "oklch(0.60 0.16 250)" },
    { label: "Sky", hue: 230, value: "oklch(0.62 0.14 230)" },
    { label: "Indigo", hue: 270, value: "oklch(0.55 0.17 270)" },
    { label: "Cyan", hue: 215, value: "oklch(0.65 0.12 215)" },
  ],
} as const;
