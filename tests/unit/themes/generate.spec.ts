import type { GenerationInputV2, StatusOverrides, Theme } from "@/types/theme";

import { converter, inGamut } from "culori";
import { describe, expect, it } from "vitest";

import {
  generatePairedVariant,
  generateTheme,
  type ThemeGenerationInput,
} from "@/modules/themes/generate";
import { ALL_KNOWN_TOKEN_NAMES } from "@/modules/themes/knownTokens";
import { deriveTypeScale } from "@/modules/themes/typeScale";

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
  it("emits the full semantic + accent + p-surface + chrome token set (85 tokens)", () => {
    const { tokens } = generateTheme(input());
    const count = Object.keys(tokens).length;
    // Exact baseline tripwire (not a wide band): minimal input emits a fixed
    // set — 78 pre-C4 + 7 unconditional --dockpanel-* chrome keys (C4). A scale
    // leak (a conditional family emitted unconditionally) trips this immediately.
    // Bump deliberately, in the same PR, when a new unconditional token lands.
    expect(count).toBe(85);
  });

  it("emits the dockview chrome tokens unconditionally as var() chains (C4)", () => {
    const { tokens } = generateTheme(input());
    expect(tokens["--dockpanel-radius"]).toBe("var(--radius-md)");
    expect(tokens["--dockpanel-border-width"]).toBe("1px");
    expect(tokens["--dockpanel-shadow"]).toBe("var(--shadow-bevel-raised)");
    expect(tokens["--dockpanel-gap"]).toBe("var(--space-1)");
    expect(tokens["--dockpanel-tab-font-size"]).toBe("var(--density-font-size)");
    expect(tokens["--dockpanel-tab-font-weight"]).toBe("var(--font-weight-medium)");
    expect(tokens["--dockpanel-tab-active-indicator"]).toBe("var(--color-interactive)");
    for (const k of Object.keys(tokens).filter((t) => t.startsWith("--dockpanel-"))) {
      expect(KNOWN.has(k)).toBe(true);
    }
  });

  it("emits the type-scale ramp + line-height companions only when typeScale is set", () => {
    const textKeys = (t: Record<string, string>) =>
      Object.keys(t).filter((k) => k.startsWith("--text-"));
    expect(textKeys(generateTheme(input()).tokens)).toEqual([]);

    const ts = { baseSize: 18, ratio: 1.25 };
    const withScale = generateTheme(input({ typeScale: ts }));
    const expected = deriveTypeScale(ts);
    expect(textKeys(withScale.tokens)).toHaveLength(16);
    for (const [k, v] of Object.entries(expected)) {
      expect(withScale.tokens[k]).toBe(v);
      expect(KNOWN.has(k)).toBe(true);
    }
    // The 16 keys are the only delta vs. the same input without a scale.
    expect(Object.keys(withScale.tokens)).toHaveLength(
      Object.keys(generateTheme(input()).tokens).length + 16,
    );
  });

  it("emits the same --text-* key set in both paired modes", () => {
    const ts = { baseSize: 16, ratio: 1.2 };
    const tk = (t: Record<string, string>) =>
      Object.keys(t)
        .filter((k) => k.startsWith("--text-"))
        .sort();
    const light = generateTheme(input({ mode: "light", typeScale: ts }));
    const dark = generateTheme(input({ mode: "dark", typeScale: ts }));
    expect(tk(light.tokens)).toEqual(tk(dark.tokens));
  });

  it("emits the elevation ramp / glow / blur only for the effects sub-keys present", () => {
    const base = generateTheme(input());
    const shadowKeys = (t: Record<string, string>) =>
      Object.keys(t).filter((k) => /^--shadow-[1-5]$/.test(k));
    // No effects → no ramp keys, no blur key.
    expect(shadowKeys(base.tokens)).toEqual([]);
    expect(base.tokens["--dockpanel-glass-blur"]).toBeUndefined();

    // depth-only → exactly the 5 ramp keys (no blur, no glow re-point).
    const depthOnly = generateTheme(input({ effects: { depth: 80 } }));
    expect(shadowKeys(depthOnly.tokens)).toHaveLength(5);
    expect(depthOnly.tokens["--dockpanel-glass-blur"]).toBeUndefined();
    expect(Object.keys(depthOnly.tokens)).toHaveLength(Object.keys(base.tokens).length + 5);
    for (const k of shadowKeys(depthOnly.tokens)) expect(KNOWN.has(k)).toBe(true);

    // depth + blur → +6 (adds --dockpanel-glass-blur).
    const depthBlur = generateTheme(input({ effects: { depth: 80, blurRadius: 12 } }));
    expect(depthBlur.tokens["--dockpanel-glass-blur"]).toBe("12px");
    expect(Object.keys(depthBlur.tokens)).toHaveLength(Object.keys(base.tokens).length + 6);

    // glow-only → re-points an EXISTING key (0 new keys), live accent ref kept.
    const glow = generateTheme(input({ effects: { glowAlpha: 0.6 } }));
    expect(shadowKeys(glow.tokens)).toEqual([]);
    expect(glow.tokens["--color-interactive-glow"]).toBe(
      "color-mix(in oklch, var(--color-interactive) 60%, transparent)",
    );
  });

  it("flattens the ramp to none at depth 0", () => {
    const flat = generateTheme(input({ effects: { depth: 0 } }));
    expect(flat.tokens["--shadow-1"]).toBe("none");
    expect(flat.tokens["--shadow-5"]).toBe("none");
  });

  it("emits the full --color-p-surface-0..950 scale (Volt component backgrounds)", () => {
    const { tokens } = generateTheme(input({ baseColor: "oklch(0.98 0.006 145)" }));
    // All 12 steps present (0, 50, 100, 200, 300, ..., 900, 950)
    const steps = [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    for (const step of steps) {
      expect(tokens[`--color-p-surface-${step}`], `step ${step}`).toBeDefined();
    }
    // Step 0 is pure white literally (matches tokens.css baseline)
    expect(tokens["--color-p-surface-0"]).toBe("#ffffff");
    // Hue carried through on the OKLCH steps (base hue 145°, low chroma)
    const hueOf = (v: string) => +(v.match(/oklch\([\d.]+\s+[\d.]+\s+([\d.-]+)/)?.[1] ?? 0);
    for (const step of [100, 500, 900]) {
      const h = hueOf(tokens[`--color-p-surface-${step}`]!);
      expect(h, `step ${step} should carry base hue 145°`).toBeGreaterThan(120);
      expect(h, `step ${step} should carry base hue 145°`).toBeLessThan(170);
    }
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
  function generatedTheme(over: Partial<Theme> = {}, statusOverrides?: StatusOverrides): Theme {
    const now = Date.now();
    const baseInput: GenerationInputV2 = {
      schemaVersion: 2,
      baseColor: "oklch(0.98 0.005 250)",
      accentColor: "oklch(0.55 0.18 250)",
      contrast: 50,
      mode: "light",
      density: "comfortable",
      ...(statusOverrides ? { statusOverrides } : {}),
    };
    return {
      id: "01HZZZZZZZZZZZZZZZZZZZZZZZZ",
      name: "Ocean",
      description: "",
      author: "",
      source: "generated",
      mode: "light",
      density: "comfortable",
      base: { kind: "generated", input: baseInput },
      overrides: {},
      tokens: generateTheme(input(statusOverrides ? { statusOverrides } : {})).tokens,
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
    const builtIn = generatedTheme({
      source: "built-in",
      base: { kind: "static", tokens: { "--color-surface-base": "#fff" } },
    });
    expect(() => generatePairedVariant(builtIn)).toThrow();
  });

  it("carries status overrides into the paired variant (symmetric coverage)", () => {
    const light = generatedTheme({ mode: "light" }, { danger: { hue: 12 } });
    const { tokens } = generatePairedVariant(light);
    // The paired variant re-points danger to ~12° too…
    expect(toOklch(tokens["--color-status-danger"])?.h ?? 0).toBeGreaterThan(0);
    expect(toOklch(tokens["--color-status-danger"])?.h ?? 99).toBeLessThan(20);
    // …and emits the same additive key set, so coverage stays symmetric.
    expect(Object.keys(tokens).sort()).toEqual(Object.keys(light.tokens).sort());
    expect(tokens["--color-toast-danger-fg"]).toBeDefined();
  });
});

describe("generateTheme — status overrides (A1b)", () => {
  const STATUS_KEYS = [
    "--color-status-success",
    "--color-status-success-subtle",
    "--color-status-warning",
    "--color-status-warning-subtle",
    "--color-status-danger",
    "--color-status-danger-subtle",
    "--color-status-info",
    "--color-status-info-subtle",
    "--color-success",
    "--color-warning",
    "--color-danger",
    "--color-info",
  ] as const;

  const ADDITIVE_KEYS = [
    "--color-status-success-border",
    "--color-status-warning-border",
    "--color-status-danger-border",
    "--color-status-info-border",
    "--color-toast-bg",
    "--color-toast-fg",
    "--color-toast-border",
    "--color-toast-success-bg",
    "--color-toast-success-fg",
    "--color-toast-info-bg",
    "--color-toast-info-fg",
    "--color-toast-warning-bg",
    "--color-toast-warning-fg",
    "--color-toast-danger-bg",
    "--color-toast-danger-fg",
  ] as const;

  it("produces byte-identical output for no / empty / undefined overrides", () => {
    const base = generateTheme(input()).tokens;
    const empty = generateTheme(input({ statusOverrides: {} })).tokens;
    const undef = generateTheme(input({ statusOverrides: undefined })).tokens;
    // Full token dictionary identical — not just the status subset.
    expect(empty).toEqual(base);
    expect(undef).toEqual(base);
  });

  it("emits NO border/toast keys when no override is present", () => {
    const { tokens } = generateTheme(input());
    for (const key of ADDITIVE_KEYS) {
      expect(tokens[key], `${key} should be absent without an override`).toBeUndefined();
    }
  });

  it("re-points only the overridden family's hue and leaves the rest", () => {
    const { tokens } = generateTheme(input({ statusOverrides: { danger: { hue: 12 } } }));
    const hueOf = (key: string) => toOklch(tokens[key])?.h ?? 0;
    // danger re-pointed to ~12° (rose), out of its default ~27° red.
    expect(hueOf("--color-status-danger")).toBeGreaterThan(5);
    expect(hueOf("--color-status-danger")).toBeLessThan(20);
    // success stays in its green family (~145°) — untouched.
    expect(hueOf("--color-status-success")).toBeGreaterThan(120);
    expect(hueOf("--color-status-success")).toBeLessThan(170);
    // The compat alias tracks the same resolved value (no desync).
    expect(tokens["--color-danger"]).toBe(tokens["--color-status-danger"]);
  });

  it("emits border + toast keys pinned to the resolved status values on override", () => {
    const { tokens } = generateTheme(input({ statusOverrides: { danger: { hue: 12 } } }));
    for (const key of ADDITIVE_KEYS) {
      expect(tokens[key], `${key} should be emitted on override`).toBeDefined();
    }
    // border = the solid, toast -fg = the solid, toast -bg = the subtle.
    expect(tokens["--color-status-danger-border"]).toBe(tokens["--color-status-danger"]);
    expect(tokens["--color-toast-danger-fg"]).toBe(tokens["--color-status-danger"]);
    expect(tokens["--color-toast-danger-bg"]).toBe(tokens["--color-status-danger-subtle"]);
    // Neutral toast tokens chain off the generated surface/text/border.
    expect(tokens["--color-toast-bg"]).toBe(tokens["--color-surface-raised"]);
    expect(tokens["--color-toast-fg"]).toBe(tokens["--color-text-primary"]);
    expect(tokens["--color-toast-border"]).toBe(tokens["--color-border-default"]);
  });

  it("keeps every override-path key inside the known-token allowlist", () => {
    const { tokens } = generateTheme(
      input({ statusOverrides: { success: { hue: 162 }, danger: { hue: 12 } } }),
    );
    const unknown = Object.keys(tokens).filter((k) => !KNOWN.has(k));
    expect(unknown).toEqual([]);
    // sanity: status keys themselves are still present + valid OKLCH
    for (const key of STATUS_KEYS) expect(tokens[key]).toBeDefined();
  });
});

describe("generateTheme — richer palette (A1c)", () => {
  const A1C_COLOR_KEYS = [
    "--color-surface-bevel-light",
    "--color-surface-bevel-dark",
    "--color-border-accent",
    "--color-interactive-glow",
    "--color-interactive-dim",
  ] as const;

  it("emits the five additive depth/accent color tokens, all known + in-gamut", () => {
    const { tokens } = generateTheme(input());
    for (const key of A1C_COLOR_KEYS) {
      expect(tokens[key], `${key} should be emitted`).toBeDefined();
      expect(KNOWN.has(key), `${key} should be allowlisted`).toBe(true);
    }
    // Every solid (non-alpha) A1c color is a displayable sRGB OKLCH.
    for (const key of [
      "--color-surface-bevel-light",
      "--color-surface-bevel-dark",
      "--color-border-accent",
      "--color-interactive-dim",
    ] as const) {
      const c = toOklch(tokens[key]);
      expect(c, `${key} parses`).toBeTruthy();
      expect(isInSrgb(c!), `${key} in gamut`).toBe(true);
    }
  });

  it("emits the glow as a gamut-valid translucent OKLCH (alpha < 1)", () => {
    const { tokens } = generateTheme(input({ mode: "dark" }));
    const glow = tokens["--color-interactive-glow"];
    expect(glow).toMatch(/^oklch\([^)]* \/ 0?\.\d+\)$/); // has an alpha component
    const c = toOklch(glow);
    expect(c).toBeTruthy();
    expect(c!.alpha).toBeLessThan(1);
    expect(isInSrgb({ ...c!, alpha: 1 })).toBe(true); // chroma/lightness displayable
  });

  it("bevel-light is lighter than bevel-dark (a real top/bottom edge pair)", () => {
    const { tokens } = generateTheme(input());
    const light = toOklch(tokens["--color-surface-bevel-light"]);
    const dark = toOklch(tokens["--color-surface-bevel-dark"]);
    expect((light?.l ?? 0) > (dark?.l ?? 1)).toBe(true);
  });

  it("the depth/accent tokens do not depend on status overrides (byte-identical)", () => {
    const base = generateTheme(input()).tokens;
    const withOverride = generateTheme(input({ statusOverrides: { danger: { hue: 12 } } })).tokens;
    for (const key of A1C_COLOR_KEYS) {
      expect(withOverride[key]).toBe(base[key]);
    }
  });
});
