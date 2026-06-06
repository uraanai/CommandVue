import { describe, expect, it } from "vitest";

import {
  DEFAULT_TYPE_SCALE,
  deriveTypeScale,
  deriveTypeScaleKnownTokenCheck,
  FIXED_RAMP_FALLBACK,
  TYPE_SCALE_STEPS,
} from "@/modules/themes/typeScale";

/** Pull the numeric rem value out of a `"<n>rem"` string. */
function rem(v: string): number {
  return Number(v.replace("rem", ""));
}

describe("deriveTypeScale (Track A C2)", () => {
  it("emits 16 keys — 8 sizes + 8 line-height companions, one pair per step", () => {
    const out = deriveTypeScale(DEFAULT_TYPE_SCALE);
    expect(Object.keys(out)).toHaveLength(16);
    for (const { token, lh } of TYPE_SCALE_STEPS) {
      expect(out[token]).toMatch(/^\d+(\.\d+)?rem$/); // sizes are "<n>rem"
      expect(out[lh]).toMatch(/^\d+(\.\d+)?$/); // companions are bare unitless numbers
    }
  });

  it("produces strictly increasing sizes from xs → 4xl", () => {
    const out = deriveTypeScale(DEFAULT_TYPE_SCALE);
    const sizes = TYPE_SCALE_STEPS.map((s) => rem(out[s.token]!));
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]!).toBeGreaterThan(sizes[i - 1]!);
    }
  });

  it("keeps `--text-base` at baseSize/16 rem regardless of ratio (base = step 0)", () => {
    for (const ratio of [1.0, 1.2, 1.25, 1.333]) {
      expect(deriveTypeScale({ baseSize: 16, ratio })["--text-base"]).toBe("1rem");
    }
    expect(deriveTypeScale({ baseSize: 18, ratio: 1.2 })["--text-base"]).toBe("1.125rem");
  });

  it("matches the golden derivation for baseSize 18 / ratio 1.25", () => {
    const out = deriveTypeScale({ baseSize: 18, ratio: 1.25 });
    expect(out["--text-base"]).toBe("1.125rem");
    expect(out["--text-base--line-height"]).toBe("1.25");
    expect(out["--text-lg"]).toBe("1.4063rem"); // 18 * 1.25 / 16, rounded to 4 dp
  });

  it("pairs each size with a line-height; larger text gets tighter leading", () => {
    const out = deriveTypeScale(DEFAULT_TYPE_SCALE);
    for (const { token, lh } of TYPE_SCALE_STEPS) {
      expect(out[token]).toBeDefined();
      expect(out[lh]).toBeDefined();
    }
    // The biggest step's leading is tighter than the smallest step's.
    expect(Number(out["--text-4xl--line-height"])).toBeLessThan(
      Number(out["--text-xs--line-height"]),
    );
  });

  it("is deterministic — identical input yields identical output", () => {
    const a = deriveTypeScale({ baseSize: 17, ratio: 1.21 });
    const b = deriveTypeScale({ baseSize: 17, ratio: 1.21 });
    expect(a).toEqual(b);
  });

  it("the FIXED_RAMP_FALLBACK covers exactly the 8 size tokens", () => {
    expect(Object.keys(FIXED_RAMP_FALLBACK).sort()).toEqual(
      TYPE_SCALE_STEPS.map((s) => s.token).sort(),
    );
  });

  it("every emitted key is in the known-token allowlist", () => {
    expect(deriveTypeScaleKnownTokenCheck()).toBe(true);
  });
});
