import type { Theme } from "@/types/theme";

import { beforeEach, describe, expect, it } from "vitest";

import { themeRepo } from "@/modules/storage/themeRepo";
import { buildExportFilename, downloadThemeFile, exportThemeToJson } from "@/modules/themes/export";
import { importThemeFromJson } from "@/modules/themes/import";
import { themeRegistry } from "@/modules/themes/registry";

import { resetStorage } from "../storage/helpers";

function makeTheme(over: Partial<Theme> = {}): Theme {
  const now = Date.now();
  return {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    name: "Sample",
    description: "test fixture",
    author: "tester",
    source: "user",
    mode: "light",
    density: "comfortable",
    tokens: {
      "--color-surface-base": "oklch(0.98 0.005 250)",
      "--color-text-primary": "oklch(0.2 0.04 264)",
    },
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

describe("exportThemeToJson", () => {
  it("wraps a theme in the PortableTheme envelope", () => {
    const theme = makeTheme();
    const parsed = JSON.parse(exportThemeToJson(theme)) as Record<string, unknown>;
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.exportedBy).toBe("commandvue");
    expect(typeof parsed.exportedByVersion).toBe("string");
    expect(typeof parsed.exportedAt).toBe("number");
    expect((parsed.theme as Theme).id).toBe(theme.id);
    expect((parsed.theme as Theme).tokens).toEqual(theme.tokens);
  });

  it("pretty-prints the JSON (indented)", () => {
    expect(exportThemeToJson(makeTheme())).toContain("\n  ");
  });
});

describe("buildExportFilename", () => {
  it("kebab-cases the theme name and appends the canonical suffix", () => {
    expect(buildExportFilename(makeTheme({ name: "Blue Light" }))).toBe(
      "blue-light.commandvue-theme.json",
    );
    expect(buildExportFilename(makeTheme({ name: "OPS Center 2024" }))).toBe(
      "ops-center-2024.commandvue-theme.json",
    );
  });

  it("collapses runs of non-alphanumerics and trims leading / trailing hyphens", () => {
    expect(buildExportFilename(makeTheme({ name: "  --Hello,  World!--  " }))).toBe(
      "hello-world.commandvue-theme.json",
    );
  });

  it("falls back to 'theme' when the name is empty / punctuation-only", () => {
    expect(buildExportFilename(makeTheme({ name: "!!!" }))).toBe("theme.commandvue-theme.json");
  });
});

describe("downloadThemeFile", () => {
  it("does not throw in a jsdom environment", () => {
    expect(() => downloadThemeFile(makeTheme())).not.toThrow();
  });
});

describe("importThemeFromJson", () => {
  beforeEach(async () => {
    await resetStorage();
    themeRegistry.__resetForTests();
  });

  it("imports a valid PortableTheme and persists it via themeRepo", async () => {
    const seed = makeTheme();
    const result = await importThemeFromJson(exportThemeToJson(seed));
    expect(result.success).toBe(true);
    expect(result.theme).toBeDefined();
    const stored = await themeRepo.getById(result.theme!.id);
    expect(stored).not.toBeNull();
    expect(stored?.tokens).toEqual(seed.tokens);
  });

  it("rejects invalid JSON with a clear error", async () => {
    const result = await importThemeFromJson("{ not valid json");
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toMatch(/Invalid JSON/);
  });

  it("rejects an unsupported schema version with a specific message", async () => {
    const result = await importThemeFromJson(
      JSON.stringify({
        schemaVersion: 99,
        exportedAt: Date.now(),
        exportedBy: "commandvue",
        exportedByVersion: "0.0.0",
        theme: {},
      }),
    );
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toMatch(/Unsupported schema version/);
    expect(result.errors?.[0]).toMatch(/99/);
  });

  it("rejects an unknown token name and surfaces it in the error", async () => {
    const seed = makeTheme({ tokens: { "--color-not-a-real-token": "#fff" } });
    const result = await importThemeFromJson(exportThemeToJson(seed));
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes("--color-not-a-real-token"))).toBe(true);
  });

  it("rejects a <script> injection in a token value", async () => {
    const seed = makeTheme({ tokens: { "--color-surface-base": "<script>x</script>" } });
    const result = await importThemeFromJson(exportThemeToJson(seed));
    expect(result.success).toBe(false);
  });

  it("forces source to 'imported' regardless of what the file claims", async () => {
    const seed = makeTheme({
      source: "generated",
      generation: {
        schemaVersion: 1,
        baseColor: "oklch(0.98 0.005 250)",
        accentColor: "oklch(0.55 0.18 250)",
        contrast: 50,
      },
    });
    const result = await importThemeFromJson(exportThemeToJson(seed));
    expect(result.success).toBe(true);
    expect(result.theme?.source).toBe("imported");
    // generation block carries through so a re-imported generated theme can
    // still be edited by the customizer (Phase E).
    expect(result.theme?.generation?.contrast).toBe(50);
  });

  describe("ID conflict resolution", () => {
    it("aborts by default and returns conflictWithExistingId", async () => {
      const seed = makeTheme();
      const first = await importThemeFromJson(exportThemeToJson(seed));
      expect(first.success).toBe(true);
      const second = await importThemeFromJson(exportThemeToJson(seed));
      expect(second.success).toBe(false);
      expect(second.conflictWithExistingId).toBe(seed.id);
    });

    it("renames the imported theme when policy is 'rename'", async () => {
      const seed = makeTheme();
      await importThemeFromJson(exportThemeToJson(seed));
      const renamed = await importThemeFromJson(exportThemeToJson(seed), { onConflict: "rename" });
      expect(renamed.success).toBe(true);
      expect(renamed.theme?.id).not.toBe(seed.id);
      expect(renamed.theme?.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(renamed.theme?.name).toMatch(/\(Imported\)$/);
      expect(renamed.warnings?.[0]).toMatch(/renaming/);
    });

    it("overwrites the existing theme when policy is 'replace'", async () => {
      const seed = makeTheme();
      const original = await importThemeFromJson(exportThemeToJson(seed));
      expect(original.success).toBe(true);
      const updated = makeTheme({
        tokens: { "--color-surface-base": "oklch(0.5 0.1 50)" },
      });
      const replaced = await importThemeFromJson(exportThemeToJson(updated), {
        onConflict: "replace",
      });
      expect(replaced.success).toBe(true);
      expect(replaced.theme?.id).toBe(seed.id);
      const stored = await themeRepo.getById(seed.id);
      expect(stored?.tokens["--color-surface-base"]).toBe("oklch(0.5 0.1 50)");
    });
  });

  it("round-trips: export → re-import (rename) preserves tokens / mode / density", async () => {
    const seed = makeTheme();
    const created = (await importThemeFromJson(exportThemeToJson(seed))).theme!;
    const re = (await importThemeFromJson(exportThemeToJson(created), { onConflict: "rename" }))
      .theme!;
    expect(re.tokens).toEqual(created.tokens);
    expect(re.mode).toBe(created.mode);
    expect(re.density).toBe(created.density);
  });

  it("registers the imported theme into themeRegistry via the repo sync", async () => {
    const seed = makeTheme();
    const result = await importThemeFromJson(exportThemeToJson(seed));
    expect(result.success).toBe(true);
    expect(themeRegistry.get(result.theme!.id)).toBeDefined();
    expect(themeRegistry.listImported()).toHaveLength(1);
  });

  describe("non-ULID id auto-mint", () => {
    it("reassigns a non-ULID id to a fresh ULID and surfaces a warning", async () => {
      const seed = makeTheme({ id: "my-cool-theme" });
      const result = await importThemeFromJson(exportThemeToJson(seed));
      expect(result.success).toBe(true);
      expect(result.theme?.id).not.toBe("my-cool-theme");
      expect(result.theme?.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(result.warnings?.[0]).toMatch(/not a valid ULID/);
      expect(result.warnings?.[0]).toContain("my-cool-theme");
    });

    it("auto-mint precedes the conflict check — same non-ULID id, different names both import", async () => {
      // Two imports sharing the same non-ULID id: each gets a fresh ULID, so
      // the abort path never fires. Different names so repo invariant 2 (name
      // uniqueness within source) doesn't muddy the assertion — that's a
      // separate concern from id collision.
      const first = await importThemeFromJson(
        exportThemeToJson(makeTheme({ id: "alpha", name: "Alpha One" })),
      );
      const second = await importThemeFromJson(
        exportThemeToJson(makeTheme({ id: "alpha", name: "Alpha Two" })),
      );
      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(first.theme?.id).not.toBe(second.theme?.id);
      expect(themeRegistry.listImported()).toHaveLength(2);
    });

    it("does NOT auto-mint when the imported id is already a valid ULID", async () => {
      const seed = makeTheme(); // default id is the canonical ULID fixture
      const result = await importThemeFromJson(exportThemeToJson(seed));
      expect(result.success).toBe(true);
      expect(result.theme?.id).toBe(seed.id);
      expect(result.warnings).toBeUndefined();
    });
  });
});
