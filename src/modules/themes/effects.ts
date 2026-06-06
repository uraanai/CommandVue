/**
 * Effects deriver (Track A C5).
 *
 * Pure string composition — no culori import, no `generate.ts` import (kills the
 * circular edge). The ramp ink derives from `--color-text-primary` via
 * `color-mix` so dark mode auto-inverts (mode-adaptive, matches the A1c posture);
 * the glow stays a live `color-mix` against `--color-interactive` so an accent
 * recolor still propagates. Absent `effects` → the engine emits nothing and the
 * tokens.css static defaults apply (byte-identical output).
 */

import type { EffectsSpec } from "@/types/theme";

/** Neutral baseline matching the tokens.css static defaults (depth-50 ramp,
 *  32% glow alpha, 8px blur). Single source for slider initial values AND the
 *  generator's ?? fallbacks — no magic numbers duplicated across two sites. */
export const EFFECTS_DEFAULTS: Required<EffectsSpec> = {
  depth: 50,
  glowAlpha: 0.32,
  blurRadius: 8,
};

const clampNum = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Per-step ramp shape: y-offset, blur, spread, ink-alpha (%). Scaled by depth. */
const RAMP_SCALE = [
  { y: 1, b: 2, s: 0, a: 8 },
  { y: 2, b: 4, s: -1, a: 10 },
  { y: 4, b: 8, s: -2, a: 12 },
  { y: 8, b: 16, s: -4, a: 14 },
  { y: 16, b: 32, s: -8, a: 18 },
] as const;

type ShadowKey = "--shadow-1" | "--shadow-2" | "--shadow-3" | "--shadow-4" | "--shadow-5";

/** Derive the 5-step elevation ramp from the depth knob. 0 → all "none"
 *  (flat); 50 → ~tokens.css neutral baseline; 100 → ~2× the neutral offsets.
 *  Ink derives from --color-text-primary so dark themes get a subtle light
 *  elevation (mode-adaptive, no dark-override block needed). */
export function deriveElevationRamp(depth: number): Record<ShadowKey, string> {
  const d = clampNum(depth, 0, 100) / 50; // 0..2, 1 = neutral
  const ink = (basePct: number): string => {
    const pct = Math.round(basePct * d * 100) / 100;
    return `color-mix(in oklch, var(--color-text-primary) ${pct}%, transparent)`;
  };
  const out = {} as Record<ShadowKey, string>;
  RAMP_SCALE.forEach((step, i) => {
    const key = `--shadow-${i + 1}` as ShadowKey;
    if (d === 0) {
      out[key] = "none";
      return;
    }
    const yy = Math.round(step.y * d);
    const bb = Math.round(step.b * d);
    out[key] = `0 ${yy}px ${bb}px ${step.s}px ${ink(step.a)}`;
  });
  return out;
}

/** Re-point --color-interactive-glow at the chosen alpha while PRESERVING the
 *  live var(--color-interactive) reference so accent recolor still propagates.
 *  Never a baked oklch() literal. */
export function deriveGlow(alpha: number): string {
  const pct = Math.round(clampNum(alpha, 0, 1) * 100);
  return `color-mix(in oklch, var(--color-interactive) ${pct}%, transparent)`;
}

/** Clamp + format the blur radius literal. */
export function deriveBlur(px: number): string {
  return `${clampNum(px, 0, 24)}px`;
}
