import type { Theme } from "@/types/theme";

import { converter, inGamut } from "culori";
import { describe, expect, it } from "vitest";

import {
  generatePairedVariant,
  generateTheme,
  type ThemeGenerationInput,
} from "@/modules/themes/generate";
import { ALL_KNOWN_TOKEN_NAMES } from "@/modules/themes/knownTokens";

const toOklch = converter("oklch");
const isInSrgb = inGamut("rgb");
const KNOWN = new Set<string>(ALL_KNOWN_TOKEN_NAMES);

function input(over: Partial<ThemeGenerationInput> = {}): ThemeGenerationInput {
  return {
    name: "Test",
    baseColor: "oklch(0.98 0.005 250)",
    accentColor: "oklch(0.55 0.18 250)",
    contrast: 50,
    mode: "light",
    density: "comfortable",
    ...over,
  };
}

/** OKLCH-valued token entries (every color token is emitted as `oklch(...)`). */
function oklchValues(tokens: Record<string, string>): string[] {
  return Object.values(tokens).filter((v) => v.startsWith("oklch("));
}

describe("generateTheme", () => {
  it("emits the full semantic token set + accent scale (~60 tokens)", () => {
    const { tokens } = generateTheme(input());
    const count = Object.keys(tokens).length;
    expect(count).toBeGreaterThanOrEqual(60);
    expect(count).toBeLessThanOrEqual(75);
  });

  it("emits the full --color-accent-50..900 scale derived from the accent hue", () => {
    const { tokens } = generateTheme(input({ accentColor: "oklch(0.55 0.18 145)" }));
    // All 10 steps present
    for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      expect(tokens[`--color-accent-${step}`], `step ${step}`).toBeDefined();
    }
    // Hue (third number in oklch(l c h)) is preserved across all steps
    const hueOf = (v: string) => +(v.match(/oklch\([\d.]+\s+[\d.]+\s+([\d.-]+)/)?.[1] ?? 0);
    for (const step of [50, 500, 900]) {
      const h = hueOf(tokens[`--color-accent-${step}`]!);
      expect(h, `step ${step} should preserve hue 145°`).toBeGreaterThan(120);
      expect(h, `step ${step} should preserve hue 145°`).toBeLessThan(170);
    }
    // Lightness decreases monotonically from 50 → 900 (lightest → darkest).
    const lOf = (v: string) => +(v.match(/oklch\(([\d.]+)/)?.[1] ?? 0);
    const ls = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) =>
      lOf(tokens[`--color-accent-${s}`]!),
    );
    for (let i = 1; i < ls.length; i++) {
      expect(
        ls[i]!,
        `step ${i * 100 || 50} should be darker than step ${(i - 1) * 100 || 50}`,
      ).toBeLessThan(ls[i - 1]!);
    }
  });

  it("emits only known overridable token names", () => {
    const { tokens } = generateTheme(input());
    const unknown = Object.keys(tokens).filter((k) => !KNOWN.has(k));
    expect(unknown).toEqual([]);
  });

  it("never emits density tokens (those come from the data-density cascade)", () => {
    const { tokens } = generateTheme(input());
    const density = Object.keys(tokens).filter((k) => k.startsWith("--density-"));
    expect(density).toEqual([]);
  });

  it("light theme passes WCAG AA with no contrast failures", () => {
    const { contrastReport } = generateTheme(input({ mode: "light" }));
    expect(contrastReport.failures).toEqual([]);
    expect(contrastReport.textOnSurface).toBeGreaterThanOrEqual(4.5);
    expect(contrastReport.textOnRaised).toBeGreaterThanOrEqual(4.5);
    expect(contrastReport.onInteractive).toBeGreaterThanOrEqual(4.5);
  });

  it("dark theme passes WCAG AA with no contrast failures", () => {
    const { contrastReport } = generateTheme(
      input({
        mode: "dark",
        baseColor: "oklch(0.16 0.01 250)",
        accentColor: "oklch(0.65 0.15 250)",
      }),
    );
    expect(contrastReport.failures).toEqual([]);
    expect(contrastReport.textOnSurface).toBeGreaterThanOrEqual(4.5);
    expect(contrastReport.textOnRaised).toBeGreaterThanOrEqual(4.5);
    expect(contrastReport.onInteractive).toBeGreaterThanOrEqual(4.5);
  });

  it("higher contrast input yields higher actual text contrast", () => {
    const low = generateTheme(input({ contrast: 30 }));
    const high = generateTheme(input({ contrast: 95 }));
    expect(high.contrastReport.textOnSurface).toBeGreaterThan(low.contrastReport.textOnSurface);
  });

  it("is deterministic — same inputs produce identical tokens", () => {
    const a = generateTheme(input());
    const b = generateTheme(input());
    expect(a.tokens).toEqual(b.tokens);
  });

  it("keeps every generated color within the sRGB gamut", () => {
    for (const mode of ["light", "dark"] as const) {
      const { tokens } = generateTheme(
        input(mode === "dark" ? { mode, baseColor: "oklch(0.16 0.02 30)" } : { mode }),
      );
      for (const value of oklchValues(tokens)) {
        expect(isInSrgb(value), `${value} should be in sRGB gamut`).toBe(true);
      }
    }
  });

  it("anchors status colors to the correct semantic hue families", () => {
    const { tokens } = generateTheme(input());
    const hueOf = (key: string) => toOklch(tokens[key])?.h ?? 0;
    // success is green-ish (~145°), not red.
    expect(hueOf("--color-status-success")).toBeGreaterThan(120);
    expect(hueOf("--color-status-success")).toBeLessThan(170);
    // danger is red-ish (~27°), not green.
    expect(hueOf("--color-status-danger")).toBeLessThan(45);
    // info is blue-ish (~250°).
    expect(hueOf("--color-status-info")).toBeGreaterThan(220);
    expect(hueOf("--color-status-info")).toBeLessThan(280);
  });

  it("surfaces brighten with elevation in light mode", () => {
    const { tokens } = generateTheme(input({ mode: "light" }));
    const l = (key: string) => toOklch(tokens[key])?.l ?? 0;
    expect(l("--color-surface-raised")).toBeGreaterThanOrEqual(l("--color-surface-base"));
    expect(l("--color-surface-overlay")).toBeGreaterThanOrEqual(l("--color-surface-raised"));
    expect(l("--color-surface-sunken")).toBeLessThan(l("--color-surface-base"));
  });

  it("dark surfaces lighten with elevation and never reach pure black", () => {
    const { tokens } = generateTheme(input({ mode: "dark", baseColor: "oklch(0.16 0.01 250)" }));
    const l = (key: string) => toOklch(tokens[key])?.l ?? 0;
    expect(l("--color-surface-base")).toBeGreaterThan(0.1); // not OLED-black
    expect(l("--color-surface-raised")).toBeGreaterThan(l("--color-surface-base"));
  });

  it("applies a font override only when provided", () => {
    expect(generateTheme(input()).tokens["--font-family-sans"]).toBeUndefined();
    const withFont = generateTheme(input({ fontFamily: "'Inter', sans-serif" }));
    expect(withFont.tokens["--font-family-sans"]).toBe("'Inter', sans-serif");
    expect(withFont.tokens["--font-family-body"]).toBe("'Inter', sans-serif");
  });

  it("accepts hex / named inputs and survives saturated + dark edge cases", () => {
    expect(() => generateTheme(input({ baseColor: "#0b1120", accentColor: "teal" }))).not.toThrow();
    const edge = generateTheme(
      input({ mode: "dark", baseColor: "oklch(0.1 0.04 300)", accentColor: "oklch(0.6 0.32 25)" }),
    );
    expect(edge.contrastReport.failures).toEqual([]);
  });

  it("throws on an invalid color string", () => {
    expect(() => generateTheme(input({ baseColor: "not-a-color" }))).toThrow();
  });
});

describe("generatePairedVariant", () => {
  function generatedTheme(over: Partial<Theme> = {}): Theme {
    const now = Date.now();
    return {
      id: "01HZZZZZZZZZZZZZZZZZZZZZZZZ",
      name: "Ocean",
      description: "",
      author: "",
      source: "generated",
      mode: "light",
      density: "comfortable",
      tokens: generateTheme(input()).tokens,
      generation: {
        schemaVersion: 1,
        baseColor: "oklch(0.98 0.005 250)",
        accentColor: "oklch(0.55 0.18 250)",
        contrast: 50,
      },
      createdAt: now,
      updatedAt: now,
      ...over,
    };
  }

  it("flips a light generated theme into a coherent dark variant", () => {
    const light = generatedTheme({ mode: "light" });
    const { tokens, contrastReport } = generatePairedVariant(light);
    // Same token coverage, flipped mode → dark surface base.
    expect(Object.keys(tokens).sort()).toEqual(Object.keys(light.tokens).sort());
    expect(toOklch(tokens["--color-surface-base"])?.l ?? 1).toBeLessThan(0.3);
    expect(contrastReport.failures).toEqual([]);
  });

  it("rejects pairing a non-generated theme", () => {
    const builtIn = generatedTheme({ source: "built-in", generation: undefined });
    expect(() => generatePairedVariant(builtIn)).toThrow();
  });
});
