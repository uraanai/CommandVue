import { describe, expect, it } from "vitest";

import { generateTheme, STATUS_HUES } from "@/modules/themes/generate";
import { migrateThemeV1ToV2, type ThemeV1Record } from "@/modules/themes/migrate";
import { __clearResolveCacheForTests, resolve } from "@/modules/themes/resolve";

const BASE = "oklch(0.15 0.04 264)";
const ACCENT = "oklch(0.6 0.18 250)";

/** Build a v1 *generated* record whose tokens are real engine output. */
function generatedV1(over: Partial<ThemeV1Record> = {}): ThemeV1Record {
  const { tokens } = generateTheme({
    name: "Gen",
    baseColor: BASE,
    accentColor: ACCENT,
    contrast: 60,
    mode: "dark",
    density: "comfortable",
  });
  return {
    id: "01HZZZZZZZZZZZZZZZZZZZZZZZ1",
    name: "Gen",
    description: "",
    author: "",
    source: "generated",
    mode: "dark",
    density: "comfortable",
    tokens,
    generation: { schemaVersion: 1, baseColor: BASE, accentColor: ACCENT, contrast: 60 },
    createdAt: 1,
    updatedAt: 2,
    ...over,
  };
}

describe("migrateThemeV1ToV2", () => {
  it("upgrades a generated theme pixel-identically (cache == stored tokens)", () => {
    __clearResolveCacheForTests();
    const v1 = generatedV1();
    const v2 = migrateThemeV1ToV2(v1);
    expect(v2.tokens).toEqual(v1.tokens); // byte-identical upgrade
    expect(resolve(v2)).toEqual(v1.tokens); // and re-resolves to the same set
  });

  it("builds a generated base from the generation inputs and pins statusHues", () => {
    __clearResolveCacheForTests();
    const v2 = migrateThemeV1ToV2(generatedV1());
    expect(v2.base.kind).toBe("generated");
    if (v2.base.kind !== "generated") throw new Error("expected generated base");
    expect(v2.base.input).toMatchObject({
      schemaVersion: 2,
      baseColor: BASE,
      accentColor: ACCENT,
      contrast: 60,
      mode: "dark",
      density: "comfortable",
    });
    expect(v2.base.input.statusHues).toEqual({ ...STATUS_HUES });
    expect(v2.overrides).toEqual({}); // stored == fresh engine output
  });

  it("folds A1b statusOverrides into base.input (the reconciling-keystone debt)", () => {
    __clearResolveCacheForTests();
    const statusOverrides = { danger: { hue: 12 } };
    const { tokens } = generateTheme({
      name: "Gen",
      baseColor: BASE,
      accentColor: ACCENT,
      contrast: 60,
      mode: "dark",
      density: "comfortable",
      statusOverrides,
    });
    const v1 = generatedV1({
      tokens,
      generation: {
        schemaVersion: 1,
        baseColor: BASE,
        accentColor: ACCENT,
        contrast: 60,
        statusOverrides,
      },
    });
    const v2 = migrateThemeV1ToV2(v1);
    if (v2.base.kind !== "generated") throw new Error("expected generated base");
    expect(v2.base.input.statusOverrides).toEqual(statusOverrides);
    expect(v2.overrides).toEqual({}); // re-generates with the same overrides → no diff
    expect(resolve(v2)).toEqual(tokens); // pixel-identical incl. status-border/toast keys
  });

  it("moves generation.paired to the top-level paired field", () => {
    __clearResolveCacheForTests();
    const v1 = generatedV1({
      generation: {
        schemaVersion: 1,
        baseColor: BASE,
        accentColor: ACCENT,
        contrast: 60,
        paired: "01PAIREDPAIREDPAIREDPAIRED1",
      },
    });
    const v2 = migrateThemeV1ToV2(v1);
    expect(v2.paired).toBe("01PAIREDPAIREDPAIREDPAIRED1");
    expect(v2.generation?.paired).toBe("01PAIREDPAIREDPAIREDPAIRED1"); // derived compat mirror
  });

  it("captures a hand-tweaked token as a sparse override", () => {
    __clearResolveCacheForTests();
    const v1 = generatedV1();
    const tweaked: ThemeV1Record = {
      ...v1,
      tokens: { ...v1.tokens, "--color-surface-base": "oklch(0.5 0 0)" },
    };
    const v2 = migrateThemeV1ToV2(tweaked);
    expect(v2.overrides).toEqual({ "--color-surface-base": "oklch(0.5 0 0)" });
    expect(resolve(v2)["--color-surface-base"]).toBe("oklch(0.5 0 0)"); // override wins on re-resolve
    expect(v2.tokens["--color-surface-base"]).toBe("oklch(0.5 0 0)"); // and in the cache
  });

  it("reconstructs fontFamily only when the stored tokens carry one", () => {
    __clearResolveCacheForTests();
    const withFont = generatedV1();
    withFont.tokens = { ...withFont.tokens, "--font-family-body": "Inter, sans-serif" };
    const v2 = migrateThemeV1ToV2(withFont);
    if (v2.base.kind !== "generated") throw new Error("expected generated base");
    expect(v2.base.input.fontFamily).toBe("Inter, sans-serif");

    const noFont = migrateThemeV1ToV2(generatedV1());
    if (noFont.base.kind !== "generated") throw new Error("expected generated base");
    expect(noFont.base.input.fontFamily).toBeUndefined();
  });

  it("converts an imported theme with no generation to a static base, preserved verbatim", () => {
    const v1: ThemeV1Record = {
      id: "01IMPORTEDIMPORTEDIMPORTED1",
      name: "Imported",
      description: "",
      author: "",
      source: "imported",
      mode: "light",
      density: "comfortable",
      tokens: { "--color-surface-base": "#fff", "--color-text-primary": "#000" },
      createdAt: 1,
      updatedAt: 2,
    };
    const v2 = migrateThemeV1ToV2(v1);
    expect(v2.base).toEqual({ kind: "static", tokens: v1.tokens });
    expect(v2.overrides).toEqual({});
    expect(v2.tokens).toEqual(v1.tokens);
    expect(v2.generation).toBeUndefined();
  });

  it("falls back to a static base (no throw) when the generation color is unparseable", () => {
    const v1 = generatedV1({
      generation: { schemaVersion: 1, baseColor: "not-a-color", accentColor: ACCENT, contrast: 60 },
    });
    const v2 = migrateThemeV1ToV2(v1);
    expect(v2.base.kind).toBe("static");
    if (v2.base.kind !== "static") throw new Error("expected static base");
    expect(v2.base.tokens).toEqual(v1.tokens); // appearance frozen, not lost
    expect(v2.generation).toBeUndefined();
  });

  it("is idempotent — an already-v2 record passes through unchanged", () => {
    const v2 = migrateThemeV1ToV2(generatedV1());
    expect(migrateThemeV1ToV2(v2)).toBe(v2);
  });
});
