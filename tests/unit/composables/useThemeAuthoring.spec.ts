import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isReactive } from "vue";

import { useThemeAuthoring } from "@/composables/useThemeAuthoring";
import { themeRepo } from "@/modules/storage/themeRepo";
import { __unregisterBuiltinThemesForTests, registerBuiltinThemes } from "@/modules/themes/builtin";
import { BLANK_DEFAULTS } from "@/modules/themes/curated-swatches";
import { EFFECTS_DEFAULTS } from "@/modules/themes/effects";

import { resetForStoreTest } from "../stores/helpers";

async function makeGeneratedTheme(name = "Seed Me") {
  return themeRepo.create({
    name,
    description: "from test",
    author: "",
    source: "generated",
    mode: "dark",
    density: "compact",
    base: {
      kind: "generated",
      input: {
        schemaVersion: 2,
        baseColor: "oklch(0.16 0.03 285)",
        accentColor: "oklch(0.7 0.16 320)",
        contrast: 62,
        mode: "dark",
        density: "compact",
      },
    },
    overrides: {},
  });
}

beforeEach(async () => {
  await resetForStoreTest();
  registerBuiltinThemes();
});

afterEach(() => {
  __unregisterBuiltinThemesForTests();
});

describe("useThemeAuthoring", () => {
  it("seeds a blank session by default", () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    expect(a.name.value).toBe("");
    expect(a.startFromMode.value).toBe("blank");
    expect(a.baseColor.value).toBe(BLANK_DEFAULTS.baseColor);
    expect(a.isEditMode.value).toBe(false);
  });

  it("pre-fills the form from a generated theme's base.input", async () => {
    const theme = await makeGeneratedTheme();
    const a = useThemeAuthoring();
    a.seedFromTheme(theme);
    expect(a.name.value).toBe("Seed Me");
    expect(a.baseColor.value).toBe("oklch(0.16 0.03 285)");
    expect(a.accentColor.value).toBe("oklch(0.7 0.16 320)");
    expect(a.contrast.value).toBe(62);
    expect(a.mode.value).toBe("dark");
    expect(a.density.value).toBe("compact");
    expect(a.isEditMode.value).toBe(true);
  });

  it("produces a live generationResult with a full token set", () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    const result = a.generationResult.value;
    expect(result).not.toBeNull();
    expect(Object.keys(result!.tokens).length).toBeGreaterThan(40);
    expect(a.contrastReport.value).not.toBeNull();
  });

  it("save() creates a generated theme plus its paired variant", async () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    a.name.value = "Author Test";
    a.applyAfterSave.value = false;
    a.generatePaired.value = true;
    const created = await a.save();
    expect(created).not.toBeNull();
    expect(created!.base.kind).toBe("generated");
    const all = await themeRepo.getAll();
    expect(all).toHaveLength(2); // primary + paired
    const primary = all.find((t) => t.id === created!.id)!;
    expect(primary.paired).toBeDefined(); // cross-linked
  });

  it("save() without the paired option creates exactly one theme", async () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    a.name.value = "Solo";
    a.applyAfterSave.value = false;
    a.generatePaired.value = false;
    await a.save();
    expect(await themeRepo.getAll()).toHaveLength(1);
  });

  it("updateExisting() updates the seeded theme in place (same id)", async () => {
    const theme = await makeGeneratedTheme("Editable");
    const a = useThemeAuthoring();
    a.seedFromTheme(theme);
    a.applyAfterSave.value = false;
    a.contrast.value = 80; // change an input
    const updated = await a.updateExisting();
    expect(updated!.id).toBe(theme.id); // same record, not a new one
    expect(updated!.base.kind === "generated" && updated!.base.input.contrast).toBe(80);
    expect(await themeRepo.getAll()).toHaveLength(1); // no duplicate
  });

  it("save() adopts the new theme into edit mode so a second save updates in place", async () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    a.name.value = "Adopt Me";
    a.applyAfterSave.value = false;
    a.generatePaired.value = false;
    const created = await a.save();
    expect(created).not.toBeNull();
    // The session now edits the just-created theme — button flips to "Update theme".
    expect(a.isEditMode.value).toBe(true);
    expect(a.themeToEdit.value?.id).toBe(created!.id);
    // A second save (the panel routes to updateExisting in edit mode) updates the
    // SAME record — no name-collision, no duplicate.
    a.contrast.value = 80;
    const updated = await a.updateExisting();
    expect(updated!.id).toBe(created!.id);
    expect(updated!.base.kind === "generated" && updated!.base.input.contrast).toBe(80);
    expect(await themeRepo.getAll()).toHaveLength(1);
  });

  it("surfaces a name-required error rather than throwing", async () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    a.name.value = "   ";
    const created = await a.save();
    expect(created).toBeNull();
    expect(a.saveError.value).toMatch(/name is required/i);
  });

  // --- Per-token overrides seam (C6) ----------------------------------------

  it("overrides CRUD: set/clear/clearAll replace immutably", () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    expect(a.overrides.value).toEqual({});
    const before = a.overrides.value;
    a.setOverride("--color-surface-base", "oklch(0.2 0.03 264)");
    expect(a.overrides.value["--color-surface-base"]).toBe("oklch(0.2 0.03 264)");
    expect(a.overrides.value).not.toBe(before); // new object identity (immutable replace)
    a.setOverride("--color-text-primary", "oklch(0.98 0 0)");
    expect(Object.keys(a.overrides.value)).toHaveLength(2);
    a.clearOverride("--color-surface-base");
    expect(a.overrides.value["--color-surface-base"]).toBeUndefined();
    expect(Object.keys(a.overrides.value)).toHaveLength(1);
    a.clearAllOverrides();
    expect(a.overrides.value).toEqual({});
  });

  it("seeds overrides from a theme's sparse map; blank seeds {}", async () => {
    const theme = await themeRepo.create({
      name: "Has Overrides",
      description: "",
      author: "",
      source: "generated",
      mode: "dark",
      density: "compact",
      base: {
        kind: "generated",
        input: {
          schemaVersion: 2,
          baseColor: "oklch(0.16 0.03 285)",
          accentColor: "oklch(0.7 0.16 320)",
          contrast: 62,
          mode: "dark",
          density: "compact",
        },
      },
      overrides: { "--color-surface-base": "oklch(0.18 0.02 264)" },
    });
    const a = useThemeAuthoring();
    a.seedFromTheme(theme);
    expect(a.overrides.value).toEqual({ "--color-surface-base": "oklch(0.18 0.02 264)" });
    a.seedFromTheme(null);
    expect(a.overrides.value).toEqual({});
  });

  it("save() persists the current overrides on the primary theme", async () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    a.name.value = "With Overrides";
    a.applyAfterSave.value = false;
    a.generatePaired.value = false;
    a.setOverride("--color-interactive", "oklch(0.6 0.2 280)");
    const created = await a.save();
    expect(created).not.toBeNull();
    const stored = (await themeRepo.getAll()).find((t) => t.id === created!.id)!;
    expect(stored.overrides["--color-interactive"]).toBe("oklch(0.6 0.2 280)");
  });

  it("rejects an unknown override token key on save", async () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    a.name.value = "Bad Token";
    a.setOverride("--not-a-real-token", "red");
    const created = await a.save();
    expect(created).toBeNull();
    expect(a.saveError.value).toMatch(/unknown token/i);
  });

  it("rejects an injection-shaped override value on save", async () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    a.name.value = "Bad Value";
    a.setOverride("--color-surface-base", "<script>alert(1)</script>");
    const created = await a.save();
    expect(created).toBeNull();
    expect(a.saveError.value).toMatch(/invalid value/i);
  });
});

describe("useThemeAuthoring — fontSpec (C3)", () => {
  it("a fontSpec drives the live generationResult body/sans tokens", () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    expect(a.fontSpec.value).toBeNull();
    a.fontSpec.value = {
      family: "Open Sans",
      source: "google",
      weights: [400, 700],
      fallback: "system-ui, sans-serif",
    };
    expect(a.generationResult.value?.tokens["--font-family-sans"]).toBe(
      "'Open Sans', system-ui, sans-serif",
    );
  });

  it("seeds fontSpec from a generated theme and nulls it on a blank seed", async () => {
    const fontSpec = { family: "Roboto", source: "google" as const, weights: [400, 700] };
    const theme = await themeRepo.create({
      name: "Has Font",
      description: "",
      author: "",
      source: "generated",
      mode: "dark",
      density: "compact",
      base: {
        kind: "generated",
        input: {
          schemaVersion: 2,
          baseColor: "oklch(0.16 0.03 285)",
          accentColor: "oklch(0.7 0.16 320)",
          contrast: 62,
          mode: "dark",
          density: "compact",
          fontSpec,
        },
      },
      overrides: {},
    });
    const a = useThemeAuthoring();
    a.seedFromTheme(theme);
    expect(a.fontSpec.value).toEqual(fontSpec);
    a.seedFromTheme(null);
    expect(a.fontSpec.value).toBeNull();
  });
});

describe("useThemeAuthoring — typeScale (C2)", () => {
  it("is null until enabled; enableTypeScale materializes the default scale", () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    expect(a.typeScale.value).toBeNull();
    expect(a.typeScaleEnabled.value).toBe(false);
    a.enableTypeScale();
    expect(a.typeScale.value).toEqual({ baseSize: 16, ratio: 1.2 });
    expect(a.typeScaleEnabled.value).toBe(true);
  });

  it("a slider setter materializes the scale and drives generationResult --text-*", () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    expect(a.generationResult.value?.tokens["--text-base"]).toBeUndefined();
    a.baseSize.value = 18; // first edit materializes the lazy-null scale
    expect(a.typeScale.value).toEqual({ baseSize: 18, ratio: 1.2 });
    expect(a.generationResult.value?.tokens["--text-base"]).toBe("1.125rem");
  });

  it("buildGenerationInput carries typeScale when enabled and omits it when null", () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    expect(a.buildGenerationInput("light").typeScale).toBeUndefined();
    a.enableTypeScale();
    a.ratio.value = 1.25;
    expect(a.buildGenerationInput("light").typeScale).toEqual({ baseSize: 16, ratio: 1.25 });
  });

  it("matchCurrentTypeScale enables the scale + seeds the fixed ramp as overrides", () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    a.matchCurrentTypeScale();
    expect(a.typeScaleEnabled.value).toBe(true);
    expect(a.overrides.value["--text-base"]).toBe("1rem");
    expect(a.overrides.value["--text-4xl"]).toBe("2.25rem");
  });

  it("seeds typeScale from a generated theme and nulls it on a blank seed", async () => {
    const typeScale = { baseSize: 17, ratio: 1.2 };
    const theme = await themeRepo.create({
      name: "Has Scale",
      description: "",
      author: "",
      source: "generated",
      mode: "dark",
      density: "compact",
      base: {
        kind: "generated",
        input: {
          schemaVersion: 2,
          baseColor: "oklch(0.16 0.03 285)",
          accentColor: "oklch(0.7 0.16 320)",
          contrast: 62,
          mode: "dark",
          density: "compact",
          typeScale,
        },
      },
      overrides: {},
    });
    const a = useThemeAuthoring();
    a.seedFromTheme(theme);
    expect(a.typeScale.value).toEqual(typeScale);
    a.seedFromTheme(null);
    expect(a.typeScale.value).toBeNull();
  });
});

describe("useThemeAuthoring — effects (C5)", () => {
  it("effects starts null; a knob materializes it into both build paths", () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    expect(a.effects.value).toBeNull();
    expect(a.generationResult.value?.tokens["--shadow-1"]).toBeUndefined();
    expect(a.buildGenerationInput("light").effects).toBeUndefined();

    a.effects.value = { ...EFFECTS_DEFAULTS, depth: 80 };
    expect(a.generationResult.value?.tokens["--shadow-1"]).toBeDefined();
    expect(a.buildGenerationInput("light").effects).toEqual({ ...EFFECTS_DEFAULTS, depth: 80 });
  });

  it("seeds effects from a generated theme and nulls it on a blank seed", async () => {
    const effects = { depth: 70, glowAlpha: 0.5, blurRadius: 10 };
    const theme = await themeRepo.create({
      name: "Has Effects",
      description: "",
      author: "",
      source: "generated",
      mode: "dark",
      density: "compact",
      base: {
        kind: "generated",
        input: {
          schemaVersion: 2,
          baseColor: "oklch(0.16 0.03 285)",
          accentColor: "oklch(0.7 0.16 320)",
          contrast: 62,
          mode: "dark",
          density: "compact",
          effects,
        },
      },
      overrides: {},
    });
    const a = useThemeAuthoring();
    a.seedFromTheme(theme);
    expect(a.effects.value).toEqual(effects);
    a.seedFromTheme(null);
    expect(a.effects.value).toBeNull();
  });

  it("reset() clears effects to null", () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    a.effects.value = { ...EFFECTS_DEFAULTS, depth: 90 };
    a.reset();
    expect(a.effects.value).toBeNull();
  });

  it("buildGenerationInput deep-clones inputs to plain objects (IDB-cloneable, no proxy)", () => {
    const a = useThemeAuthoring();
    a.seedFromTheme(null);
    a.effects.value = { ...EFFECTS_DEFAULTS, depth: 70 }; // reactive-ref proxy
    const built = a.buildGenerationInput("light");
    expect(built.effects).toEqual({ ...EFFECTS_DEFAULTS, depth: 70 });
    // Must be a plain object, not a reactive proxy — IndexedDB can't clone a proxy
    // ("could not be cloned" on save), which is exactly the bug this guards.
    expect(isReactive(built.effects)).toBe(false);
    expect(() => structuredClone(built)).not.toThrow();
  });
});
