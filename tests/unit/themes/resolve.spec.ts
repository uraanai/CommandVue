import type { GenerationInputV2, ThemeBase } from "@/types/theme";

import { beforeEach, describe, expect, it } from "vitest";

import { generateTheme } from "@/modules/themes/generate";
import {
  __clearResolveCacheForTests,
  deriveGenerationMeta,
  resolve,
  resolveBaseTokens,
  toGenInput,
} from "@/modules/themes/resolve";
import { deriveTypeScale } from "@/modules/themes/typeScale";

function genInput(over: Partial<GenerationInputV2> = {}): GenerationInputV2 {
  return {
    schemaVersion: 2,
    baseColor: "oklch(0.15 0.04 264)",
    accentColor: "oklch(0.6 0.18 250)",
    contrast: 60,
    mode: "dark",
    density: "comfortable",
    ...over,
  };
}

beforeEach(() => {
  __clearResolveCacheForTests();
});

describe("resolve", () => {
  it("forwards typeScale through toGenInput when present, omits it when absent", () => {
    expect(toGenInput(genInput(), "X").typeScale).toBeUndefined();
    const ts = { baseSize: 16, ratio: 1.2 };
    expect(toGenInput(genInput({ typeScale: ts }), "X").typeScale).toEqual(ts);
  });

  it("resolves the derived --text-base for a generated base carrying typeScale", () => {
    const ts = { baseSize: 18, ratio: 1.2 };
    const tokens = resolve({
      base: { kind: "generated", input: genInput({ typeScale: ts }) },
      overrides: {},
      name: "G",
    });
    expect(tokens["--text-base"]).toBe(deriveTypeScale(ts)["--text-base"]);
  });

  it("returns a static base's tokens verbatim when there are no overrides", () => {
    const base: ThemeBase = { kind: "static", tokens: { "--color-surface-base": "#101010" } };
    const tokens = resolve({ base, overrides: {}, name: "Static" });
    expect(tokens).toEqual({ "--color-surface-base": "#101010" });
  });

  it("layers sparse overrides over the base with override-wins semantics", () => {
    const base: ThemeBase = {
      kind: "static",
      tokens: { "--color-surface-base": "#101010", "--color-text-primary": "#ffffff" },
    };
    const tokens = resolve({
      base,
      overrides: { "--color-surface-base": "#222222" },
      name: "Static",
    });
    expect(tokens["--color-surface-base"]).toBe("#222222"); // override wins
    expect(tokens["--color-text-primary"]).toBe("#ffffff"); // base preserved
  });

  it("does not mutate the memoized base when overrides are applied", () => {
    const input = genInput();
    const base: ThemeBase = { kind: "generated", input };
    const first = resolve({ base, overrides: { "--color-surface-base": "#000" }, name: "G" });
    const second = resolve({ base, overrides: {}, name: "G" });
    expect(first["--color-surface-base"]).toBe("#000");
    // The second resolve, with no overrides, must NOT see the first's override.
    expect(second["--color-surface-base"]).not.toBe("#000");
  });

  it("materializes a generated base identically to a direct generateTheme call", () => {
    const input = genInput();
    const expected = generateTheme(toGenInput(input, "G")).tokens;
    const tokens = resolve({ base: { kind: "generated", input }, overrides: {}, name: "G" });
    expect(tokens).toEqual(expected);
  });
});

describe("resolveBaseTokens (memoization)", () => {
  it("returns the same cached reference for an identical generated input", () => {
    const base: ThemeBase = { kind: "generated", input: genInput() };
    const a = resolveBaseTokens(base, "G");
    const b = resolveBaseTokens(base, "G");
    expect(a).toBe(b); // memo hit — no second engine run
  });

  it("does not collide two inputs that differ only in a status override", () => {
    const plain: ThemeBase = { kind: "generated", input: genInput() };
    const shifted: ThemeBase = {
      kind: "generated",
      input: genInput({ statusOverrides: { danger: { hue: 12 } } }),
    };
    const a = resolveBaseTokens(plain, "G");
    const b = resolveBaseTokens(shifted, "G");
    expect(a).not.toBe(b); // distinct cache keys
  });

  it("returns a static base's own token object", () => {
    const tokens = { "--color-surface-base": "#101010" };
    expect(resolveBaseTokens({ kind: "static", tokens }, "S")).toBe(tokens);
  });
});

describe("toGenInput", () => {
  it("maps the v2 input to the engine input and drops statusHues", () => {
    const out = toGenInput(
      genInput({ statusHues: { danger: 10 }, fontFamily: "Inter", statusOverrides: { info: {} } }),
      "Mapped",
    );
    expect(out).toMatchObject({
      baseColor: "oklch(0.15 0.04 264)",
      accentColor: "oklch(0.6 0.18 250)",
      contrast: 60,
      mode: "dark",
      density: "comfortable",
      name: "Mapped",
      fontFamily: "Inter",
      statusOverrides: { info: {} },
    });
    expect(out).not.toHaveProperty("statusHues");
  });

  it("omits fontFamily and statusOverrides when unset", () => {
    const out = toGenInput(genInput(), "Bare");
    expect(out).not.toHaveProperty("fontFamily");
    expect(out).not.toHaveProperty("statusOverrides");
  });
});

describe("deriveGenerationMeta", () => {
  it("derives the compat block from a generated base, mirroring paired", () => {
    const meta = deriveGenerationMeta({
      base: { kind: "generated", input: genInput({ statusOverrides: { danger: { hue: 12 } } }) },
      paired: "01ABC",
    });
    expect(meta).toEqual({
      schemaVersion: 1,
      baseColor: "oklch(0.15 0.04 264)",
      accentColor: "oklch(0.6 0.18 250)",
      contrast: 60,
      paired: "01ABC",
      statusOverrides: { danger: { hue: 12 } },
    });
  });

  it("returns undefined for a static base", () => {
    expect(
      deriveGenerationMeta({ base: { kind: "static", tokens: {} }, paired: undefined }),
    ).toBeUndefined();
  });
});
