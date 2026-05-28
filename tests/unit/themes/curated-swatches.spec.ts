import { describe, expect, it } from "vitest";

import {
  ACCENT_COLOR_SWATCHES,
  BASE_COLOR_SWATCHES,
  BLANK_DEFAULTS,
  CURATED_FONTS,
} from "@/modules/themes/curated-swatches";
import { generateTheme } from "@/modules/themes/generate";
import { ALL_KNOWN_TOKEN_NAMES } from "@/modules/themes/knownTokens";

const OKLCH_RE = /^oklch\([\d.]+ [\d.]+ [\d.-]+(?: \/ [\d.]+)?\)$/;

describe("curated-swatches", () => {
  it("BLANK_DEFAULTS values appear in the curated arrays (no drift between defaults and arrays)", () => {
    expect(BASE_COLOR_SWATCHES.some((s) => s.value === BLANK_DEFAULTS.baseColor)).toBe(true);
    expect(ACCENT_COLOR_SWATCHES.some((s) => s.value === BLANK_DEFAULTS.accentColor)).toBe(true);
    expect(CURATED_FONTS.some((f) => f.value === BLANK_DEFAULTS.fontFamily)).toBe(true);
  });

  it("every base / accent swatch is a syntactically valid OKLCH string", () => {
    // Swatches are curated *guidance* values for the generator; the engine's
    // clampChroma + inGamut tightening map them into sRGB at emission time.
    // The last test exercises that round-trip for every accent.
    for (const s of [...BASE_COLOR_SWATCHES, ...ACCENT_COLOR_SWATCHES]) {
      expect(s.value, `${s.label} (${s.value}) should match oklch(...) form`).toMatch(OKLCH_RE);
    }
  });

  it("every swatch has a non-empty label, and labels are unique within each array", () => {
    for (const arr of [BASE_COLOR_SWATCHES, ACCENT_COLOR_SWATCHES, CURATED_FONTS]) {
      const labels = arr.map((s) => s.label);
      expect(new Set(labels).size).toBe(labels.length);
      for (const label of labels) expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it("swatch arrays are roughly Linear-sized (8–10 entries) for single-row layouts", () => {
    expect(BASE_COLOR_SWATCHES.length).toBeGreaterThanOrEqual(8);
    expect(BASE_COLOR_SWATCHES.length).toBeLessThanOrEqual(10);
    expect(ACCENT_COLOR_SWATCHES.length).toBeGreaterThanOrEqual(8);
    expect(ACCENT_COLOR_SWATCHES.length).toBeLessThanOrEqual(10);
  });

  it("running each accent through generateTheme produces no contrast failures with defaults", () => {
    const KNOWN = new Set<string>(ALL_KNOWN_TOKEN_NAMES);
    for (const accent of ACCENT_COLOR_SWATCHES) {
      const result = generateTheme({
        name: "swatch-test",
        baseColor: BLANK_DEFAULTS.baseColor,
        accentColor: accent.value,
        contrast: BLANK_DEFAULTS.contrast,
        mode: "light",
        density: "comfortable",
      });
      expect(
        result.contrastReport.failures,
        `accent ${accent.label} should not produce failures`,
      ).toEqual([]);
      // Spot-check token alignment with the known-token allowlist.
      for (const k of Object.keys(result.tokens)) {
        expect(KNOWN.has(k), `accent ${accent.label} emitted unknown token ${k}`).toBe(true);
      }
    }
  });
});
