import type { FontSpec, GenerationInputV2, Theme } from "@/types/theme";

import { beforeEach, describe, expect, it } from "vitest";

import { exportThemeToJson } from "@/modules/themes/export";
import { generateTheme } from "@/modules/themes/generate";
import { importThemeFromJson } from "@/modules/themes/import";
import { themeRegistry } from "@/modules/themes/registry";
import { toGenInput } from "@/modules/themes/resolve";

import { resetStorage } from "../storage/helpers";

const BASE = "oklch(0.98 0.005 250)";
const ACCENT = "oklch(0.55 0.18 250)";

function genInput(over: Partial<GenerationInputV2> = {}): GenerationInputV2 {
  return {
    schemaVersion: 2,
    baseColor: BASE,
    accentColor: ACCENT,
    contrast: 50,
    mode: "light",
    density: "comfortable",
    ...over,
  };
}
function makeGeneratedTheme(fontSpec?: FontSpec): Theme {
  const input = genInput(fontSpec ? { fontSpec } : {});
  const now = 1_700_000_000_000;
  return {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    name: "FontTheme",
    description: "",
    author: "",
    source: "generated",
    mode: "light",
    density: "comfortable",
    base: { kind: "generated", input },
    overrides: {},
    tokens: generateTheme(toGenInput(input, "FontTheme")).tokens,
    createdAt: now,
    updatedAt: now,
  };
}

describe("C3 engine derivation", () => {
  it("derives the composed stack from a fontSpec (google); no heading key", () => {
    const { tokens } = generateTheme({
      ...genInput(),
      name: "X",
      fontSpec: {
        family: "Open Sans",
        source: "google",
        weights: [400, 700],
        fallback: "system-ui, sans-serif",
      },
    });
    expect(tokens["--font-family-sans"]).toBe("'Open Sans', system-ui, sans-serif");
    expect(tokens["--font-family-body"]).toBe("'Open Sans', system-ui, sans-serif");
    expect(tokens["--font-family-heading"]).toBeUndefined();
  });

  it("emits a single-word family unquoted", () => {
    const { tokens } = generateTheme({
      ...genInput(),
      name: "X",
      fontSpec: { family: "Roboto", source: "google", fallback: "sans-serif" },
    });
    expect(tokens["--font-family-sans"]).toBe("Roboto, sans-serif");
  });

  it("a legacy fontFamily-only theme emits the string verbatim and no heading (byte-identity)", () => {
    const { tokens } = generateTheme({
      ...genInput(),
      name: "X",
      fontFamily: "'Inter', sans-serif",
    });
    expect(tokens["--font-family-sans"]).toBe("'Inter', sans-serif");
    expect(tokens["--font-family-body"]).toBe("'Inter', sans-serif");
    expect(tokens["--font-family-heading"]).toBeUndefined();
  });

  it("a fontless theme emits no font tokens", () => {
    const { tokens } = generateTheme({ ...genInput(), name: "X" });
    expect(tokens["--font-family-sans"]).toBeUndefined();
    expect(tokens["--font-family-body"]).toBeUndefined();
  });
});

describe("C3 fontSpec portability", () => {
  beforeEach(async () => {
    await resetStorage();
    themeRegistry.__resetForTests();
  });

  it("round-trips fontSpec through export → import (intact)", async () => {
    const fontSpec: FontSpec = {
      family: "Roboto",
      source: "google",
      weights: [400, 700],
      fallback: "system-ui, sans-serif",
    };
    const imported = (await importThemeFromJson(exportThemeToJson(makeGeneratedTheme(fontSpec))))
      .theme;
    expect(imported?.base.kind).toBe("generated");
    if (imported?.base.kind === "generated") {
      expect(imported.base.input.fontSpec).toEqual(fontSpec);
    }
  });

  it("rejects an injection-shaped fontSpec.family on import", async () => {
    const json = JSON.parse(
      exportThemeToJson(makeGeneratedTheme({ family: "Roboto", source: "google" })),
    ) as {
      theme: { base: { input: { fontSpec: { family: string } } } };
    };
    json.theme.base.input.fontSpec.family = "Inter');@import url(evil)";
    expect((await importThemeFromJson(JSON.stringify(json))).success).toBe(false);
  });

  it("rejects an out-of-bounds fontSpec weight on import", async () => {
    const json = JSON.parse(
      exportThemeToJson(makeGeneratedTheme({ family: "Roboto", source: "google", weights: [400] })),
    ) as {
      theme: { base: { input: { fontSpec: { weights: number[] } } } };
    };
    json.theme.base.input.fontSpec.weights = [5000];
    expect((await importThemeFromJson(JSON.stringify(json))).success).toBe(false);
  });
});
