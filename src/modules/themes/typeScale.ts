/**
 * Modular type-scale deriver (Track A C2).
 *
 * Pure, isolated, deterministic: maps a {@link TypeScaleInput} (`baseSize` px +
 * modular `ratio`) to the `--text-xs … --text-4xl` ramp AND each step's
 * `--text-*--line-height` companion. The engine calls this only when a generated
 * theme carries `base.input.typeScale`; absent it, the fixed `tokens.css` ramp is
 * the cascade fallback (additive — §3i engine-stability contract).
 *
 * No engine / DOM / Vue imports — unit-tested in isolation (`typeScale.spec.ts`).
 * Does NOT clamp: out-of-range values are rejected upstream by Zod (whose range
 * mirrors {@link TYPE_SCALE_BOUNDS}) at the import/persist boundary, so the
 * persisted value always equals what renders.
 */

import type { TypeScaleInput } from "@/types/theme";

import { isKnownToken } from "./knownTokens";

/** Step offsets relative to `--text-base` (exponent on the ratio). base = 0. */
export const TYPE_SCALE_STEPS = [
  { token: "--text-xs", lh: "--text-xs--line-height", step: -2 },
  { token: "--text-sm", lh: "--text-sm--line-height", step: -1 },
  { token: "--text-base", lh: "--text-base--line-height", step: 0 },
  { token: "--text-lg", lh: "--text-lg--line-height", step: 1 },
  { token: "--text-xl", lh: "--text-xl--line-height", step: 2 },
  { token: "--text-2xl", lh: "--text-2xl--line-height", step: 3 },
  { token: "--text-3xl", lh: "--text-3xl--line-height", step: 4 },
  { token: "--text-4xl", lh: "--text-4xl--line-height", step: 5 },
] as const;

/** Bounds — surfaced by the Studio controls and enforced by Zod (the single
 *  enforcement point: out-of-range is REJECTED at import/persist, never clamped,
 *  so the persisted value always equals the rendered value). Ratio max is capped
 *  at 1.333 (perfect fourth) so derived line-heights stay legible (D4). */
export const TYPE_SCALE_BOUNDS = {
  baseSize: { min: 10, max: 24, default: 16, step: 0.5 },
  ratio: { min: 1.0, max: 1.333, default: 1.2, step: 0.01 },
} as const;

export const DEFAULT_TYPE_SCALE: TypeScaleInput = {
  baseSize: TYPE_SCALE_BOUNDS.baseSize.default,
  ratio: TYPE_SCALE_BOUNDS.ratio.default,
};

/** Today's fixed tokens.css ramp (rem) — used by the "Match current" seed so
 *  enabling the scale is visually neutral until the user moves a slider. */
export const FIXED_RAMP_FALLBACK: Record<string, string> = {
  "--text-xs": "0.75rem",
  "--text-sm": "0.875rem",
  "--text-base": "1rem",
  "--text-lg": "1.125rem",
  "--text-xl": "1.25rem",
  "--text-2xl": "1.5rem",
  "--text-3xl": "1.875rem",
  "--text-4xl": "2.25rem",
};

/** Line-height multiplier per derived size (unitless). Larger text gets tighter
 *  leading; small text gets generous leading. Keeps lines from clipping at high
 *  ratios — the size+leading grow together (resolves the C2 line-height MAJOR). */
function leadingFor(remSize: number): number {
  if (remSize >= 1.5) return 1.15;
  if (remSize >= 1.125) return 1.25;
  return 1.5;
}

/**
 * Derive the `--text-*` ramp + `--text-*--line-height` companions from a modular
 * scale. Each size is `baseSize × ratio^step` px → rem (÷16), rounded to 4 dp,
 * emitted as `"<n>rem"`. Each companion is a unitless number string. Pure +
 * deterministic. Does NOT clamp: out-of-range values are rejected upstream by Zod
 * (Zod range == TYPE_SCALE_BOUNDS) at the import/persist boundary, so the deriver
 * only ever sees in-range input and the persisted value always equals what renders.
 */
export function deriveTypeScale(input: TypeScaleInput): Record<string, string> {
  const { baseSize, ratio } = input;
  const out: Record<string, string> = {};
  for (const { token, lh, step } of TYPE_SCALE_STEPS) {
    const rem = Math.round(((baseSize * Math.pow(ratio, step)) / 16) * 1e4) / 1e4;
    out[token] = `${rem}rem`;
    out[lh] = String(leadingFor(rem));
  }
  return out;
}

/** Dev-only sanity: every emitted key must be allowlisted. */
export function deriveTypeScaleKnownTokenCheck(): boolean {
  return TYPE_SCALE_STEPS.every((s) => isKnownToken(s.token) && isKnownToken(s.lh));
}
