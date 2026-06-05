import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useThemeAuthoring } from "@/composables/useThemeAuthoring";
import { themeRepo } from "@/modules/storage/themeRepo";
import { __unregisterBuiltinThemesForTests, registerBuiltinThemes } from "@/modules/themes/builtin";
import { BLANK_DEFAULTS } from "@/modules/themes/curated-swatches";

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
