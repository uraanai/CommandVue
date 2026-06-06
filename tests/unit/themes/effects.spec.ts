import { describe, expect, it } from "vitest";

import {
  deriveBlur,
  deriveElevationRamp,
  deriveGlow,
  EFFECTS_DEFAULTS,
} from "@/modules/themes/effects";

const KEYS = ["--shadow-1", "--shadow-2", "--shadow-3", "--shadow-4", "--shadow-5"] as const;

/** Parse the y-offset px (2nd token) from "0 <y>px <b>px <s>px <ink>". */
function yOffset(shadow: string): number {
  return Number((shadow.split(" ")[1] ?? "0").replace("px", ""));
}

describe("effects deriver (Track A C5)", () => {
  it("EFFECTS_DEFAULTS is the neutral baseline", () => {
    expect(EFFECTS_DEFAULTS).toEqual({ depth: 50, glowAlpha: 0.32, blurRadius: 8 });
  });

  it("deriveElevationRamp(50) emits 5 non-none shadows shaped like a box-shadow", () => {
    const ramp = deriveElevationRamp(50);
    for (const k of KEYS) {
      expect(ramp[k]).not.toBe("none");
      expect(ramp[k]).toMatch(
        /^0 \d+px \d+px -?\d+px color-mix\(in oklch, var\(--color-text-primary\) [\d.]+%, transparent\)$/,
      );
    }
  });

  it("deriveElevationRamp(0) is fully flat (all none)", () => {
    const ramp = deriveElevationRamp(0);
    for (const k of KEYS) expect(ramp[k]).toBe("none");
  });

  it("deriveElevationRamp(100) doubles the depth-50 y-offsets (monotonic depth)", () => {
    const mid = deriveElevationRamp(50);
    const max = deriveElevationRamp(100);
    for (const k of KEYS) {
      expect(yOffset(max[k])).toBe(yOffset(mid[k]) * 2);
    }
  });

  it("deriveGlow preserves the live accent reference at the chosen alpha, clamped 0..1", () => {
    expect(deriveGlow(0.6)).toBe("color-mix(in oklch, var(--color-interactive) 60%, transparent)");
    expect(deriveGlow(2)).toContain("100%"); // clamped high
    expect(deriveGlow(-1)).toContain("0%"); // clamped low
  });

  it("deriveBlur clamps to 0..24px", () => {
    expect(deriveBlur(10)).toBe("10px");
    expect(deriveBlur(30)).toBe("24px");
    expect(deriveBlur(-5)).toBe("0px");
  });
});
