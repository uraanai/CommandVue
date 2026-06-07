import type { Theme, ThemeBase } from "@/types/theme";

import { beforeEach, describe, expect, it } from "vitest";

import { themeRepo } from "@/modules/storage/themeRepo";
import { buildExportFilename, downloadThemeFile, exportThemeToJson } from "@/modules/themes/export";
import { importThemeFromJson } from "@/modules/themes/import";
import { themeRegistry } from "@/modules/themes/registry";
import { resolve } from "@/modules/themes/resolve";

import { resetStorage } from "../storage/helpers";

function makeTheme(over: Partial<Theme> = {}): Theme {
  const now = Date.now();
  // For a static fixture, `tokens` (the cache) and `base.tokens` are the same
  // bag, so a `tokens` override drives both — otherwise a re-import would resolve
  // the static base and ignore the overridden cache. A `base` override wins.
  const tokens = over.tokens ?? {
    "--color-surface-base": "oklch(0.98 0.005 250)",
    "--color-text-primary": "oklch(0.2 0.04 264)",
  };
  const base: ThemeBase = over.base ?? { kind: "static", tokens };
  return {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    name: "Sample",
    description: "test fixture",
    author: "tester",
    source: "user",
    mode: "light",
    density: "comfortable",
    ...over,
    base,
    overrides: over.overrides ?? {},
    tokens,
    createdAt: now,
    updatedAt: now,
  };
}

describe("portable typeScale (C2)", () => {
  beforeEach(async () => {
    await resetStorage();
    themeRegistry.__resetForTests();
  });

  const genInput = (ts: { baseSize: number; ratio: number }) =>
    ({
      schemaVersion: 2,
      baseColor: "oklch(0.16 0.03 285)",
      accentColor: "oklch(0.7 0.16 320)",
      contrast: 62,
      mode: "dark",
      density: "compact",
      typeScale: ts,
    }) as const;

  function seedWithTypeScale(ts: { baseSize: number; ratio: number }): Theme {
    const input = genInput(ts);
    return makeTheme({
      source: "generated",
      mode: "dark",
      density: "compact",
      base: { kind: "generated", input },
      tokens: resolve({ base: { kind: "generated", input }, overrides: {}, name: "TS" }),
    });
  }

  it("round-trips a generated theme's typeScale through export → import", async () => {
    const ts = { baseSize: 18, ratio: 1.25 };
    const result = await importThemeFromJson(exportThemeToJson(seedWithTypeScale(ts)));
    expect(result.success).toBe(true);
    const stored = result.theme!;
    expect(stored.base.kind === "generated" && stored.base.input.typeScale).toEqual(ts);
    expect(stored.tokens["--text-base"]).toBe("1.125rem");
  });

  it("rejects an out-of-range typeScale on import (rejected, never clamped)", async () => {
    const json = JSON.parse(
      exportThemeToJson(seedWithTypeScale({ baseSize: 18, ratio: 1.25 })),
    ) as {
      theme: { base: { input: { typeScale: { baseSize: number } } } };
    };
    json.theme.base.input.typeScale.baseSize = 30; // out of [10, 24]
    const bad = await importThemeFromJson(JSON.stringify(json));
    expect(bad.success).toBe(false);
  });
});

describe("portable effects (C5)", () => {
  beforeEach(async () => {
    await resetStorage();
    themeRegistry.__resetForTests();
  });

  function seedWithEffects(effects: {
    depth?: number;
    glowAlpha?: number;
    blurRadius?: number;
  }): Theme {
    const input = {
      schemaVersion: 2,
      baseColor: "oklch(0.16 0.03 285)",
      accentColor: "oklch(0.7 0.16 320)",
      contrast: 62,
      mode: "dark",
      density: "compact",
      effects,
    } as const;
    return makeTheme({
      source: "generated",
      mode: "dark",
      density: "compact",
      base: { kind: "generated", input },
      tokens: resolve({ base: { kind: "generated", input }, overrides: {}, name: "FX" }),
    });
  }

  it("round-trips a generated theme's effects through export → import", async () => {
    const fx = { depth: 70, glowAlpha: 0.5, blurRadius: 10 };
    const result = await importThemeFromJson(exportThemeToJson(seedWithEffects(fx)));
    expect(result.success).toBe(true);
    const stored = result.theme!;
    expect(stored.base.kind === "generated" && stored.base.input.effects).toEqual(fx);
    expect(stored.tokens["--dockpanel-glass-blur"]).toBe("10px");
  });

  it("strips an unknown effects sub-key on import (forward-compat)", async () => {
    const json = JSON.parse(exportThemeToJson(seedWithEffects({ depth: 60 }))) as {
      theme: { base: { input: { effects: Record<string, unknown> } } };
    };
    json.theme.base.input.effects.futureKnob = 5;
    const result = await importThemeFromJson(JSON.stringify(json));
    expect(result.success).toBe(true);
    const stored = result.theme!;
    const fx = stored.base.kind === "generated" ? stored.base.input.effects : undefined;
    expect(fx).toEqual({ depth: 60 }); // unknown sub-key dropped
  });

  it("rejects an out-of-range effects value on import (rejected, never clamped)", async () => {
    const json = JSON.parse(exportThemeToJson(seedWithEffects({ depth: 60 }))) as {
      theme: { base: { input: { effects: { depth: number } } } };
    };
    json.theme.base.input.effects.depth = 999; // out of [0, 100]
    const bad = await importThemeFromJson(JSON.stringify(json));
    expect(bad.success).toBe(false);
  });
});

describe("exportThemeToJson", () => {
  it("wraps a theme in the PortableTheme envelope", () => {
    const theme = makeTheme();
    const parsed = JSON.parse(exportThemeToJson(theme)) as Record<string, unknown>;
    expect(parsed.schemaVersion).toBe(2);
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
      base: {
        kind: "generated",
        input: {
          schemaVersion: 2,
          baseColor: "oklch(0.98 0.005 250)",
          accentColor: "oklch(0.55 0.18 250)",
          contrast: 50,
          mode: "light",
          density: "comfortable",
        },
      },
    });
    const result = await importThemeFromJson(exportThemeToJson(seed));
    expect(result.success).toBe(true);
    expect(result.theme?.source).toBe("imported");
    // The generated base survives (so the customizer can re-edit), and the
    // derived `generation` compat block reflects its inputs.
    expect(result.theme?.base.kind).toBe("generated");
    expect(result.theme?.generation?.contrast).toBe(50);
  });

  it("upcasts a version 1 export (incl. legacy --color-p-surface-* keys) to v2", async () => {
    const v1File = JSON.stringify({
      schemaVersion: 1,
      exportedAt: Date.now(),
      exportedBy: "commandvue",
      exportedByVersion: "0.1.0",
      theme: {
        id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        name: "Legacy Import",
        description: "a v1 file in the wild",
        author: "old-app",
        source: "imported",
        mode: "light",
        density: "comfortable",
        tokens: {
          "--color-surface-base": "oklch(0.98 0.005 250)",
          "--color-text-primary": "oklch(0.2 0.04 264)",
          "--color-p-surface-0": "#ffffff",
        },
        createdAt: 1,
        updatedAt: 2,
      },
    });
    const result = await importThemeFromJson(v1File);
    expect(result.success).toBe(true);
    expect(result.theme?.source).toBe("imported");
    expect(result.theme?.base.kind).toBe("static");
    expect(result.theme?.tokens["--color-p-surface-0"]).toBe("#ffffff"); // legacy key preserved
    expect(result.warnings?.some((w) => /version 1/.test(w))).toBe(true);
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

  describe("name collision (in addition to id collision)", () => {
    it("rename: different ULID but same name still triggers the rename branch", async () => {
      // First import establishes a record with name "Twin"
      const a = await importThemeFromJson(
        exportThemeToJson(makeTheme({ id: "01AAAAAAAAAAAAAAAAAAAAAAAA", name: "Twin" })),
      );
      expect(a.success).toBe(true);
      // Second: different ULID, same name → name conflict; rename adds " (Imported)"
      const b = await importThemeFromJson(
        exportThemeToJson(makeTheme({ id: "01BBBBBBBBBBBBBBBBBBBBBBBB", name: "Twin" })),
        { onConflict: "rename" },
      );
      expect(b.success).toBe(true);
      expect(b.theme?.name).toBe("Twin (Imported)");
      expect(b.warnings?.[0]).toMatch(/renaming to "Twin \(Imported\)"/);
    });

    it("rename: iteratively suffixes when '(Imported)' is also taken", async () => {
      await importThemeFromJson(
        exportThemeToJson(makeTheme({ id: "01AAAAAAAAAAAAAAAAAAAAAAAA", name: "Triple" })),
      );
      await importThemeFromJson(
        exportThemeToJson(makeTheme({ id: "01BBBBBBBBBBBBBBBBBBBBBBBB", name: "Triple" })),
        { onConflict: "rename" },
      );
      // Now both "Triple" and "Triple (Imported)" exist; third gets "(Imported 2)".
      const c = await importThemeFromJson(
        exportThemeToJson(makeTheme({ id: "01CCCCCCCCCCCCCCCCCCCCCCCC", name: "Triple" })),
        { onConflict: "rename" },
      );
      expect(c.success).toBe(true);
      expect(c.theme?.name).toBe("Triple (Imported 2)");
    });

    it("replace: deletes the name-colliding record (different id)", async () => {
      await importThemeFromJson(
        exportThemeToJson(
          makeTheme({
            id: "01AAAAAAAAAAAAAAAAAAAAAAAA",
            name: "Override",
            tokens: { "--color-surface-base": "oklch(0.9 0.01 0)" },
          }),
        ),
      );
      const replacement = await importThemeFromJson(
        exportThemeToJson(
          makeTheme({
            id: "01BBBBBBBBBBBBBBBBBBBBBBBB",
            name: "Override",
            tokens: { "--color-surface-base": "oklch(0.2 0.01 0)" },
          }),
        ),
        { onConflict: "replace" },
      );
      expect(replacement.success).toBe(true);
      expect(replacement.theme?.id).toBe("01BBBBBBBBBBBBBBBBBBBBBBBB");
      // Original (different id, same name) deleted
      expect(await themeRepo.getById("01AAAAAAAAAAAAAAAAAAAAAAAA")).toBeNull();
      // Only one "Override" remains
      expect(themeRegistry.listImported().filter((t) => t.name === "Override")).toHaveLength(1);
    });

    it("abort: surfaces the name-colliding record's id when only the name clashes", async () => {
      const first = await importThemeFromJson(
        exportThemeToJson(makeTheme({ id: "01AAAAAAAAAAAAAAAAAAAAAAAA", name: "Blocked" })),
      );
      const second = await importThemeFromJson(
        exportThemeToJson(makeTheme({ id: "01BBBBBBBBBBBBBBBBBBBBBBBB", name: "Blocked" })),
      );
      expect(second.success).toBe(false);
      expect(second.conflictWithExistingId).toBe(first.theme?.id);
      expect(second.errors?.[0]).toMatch(/named "Blocked"/);
    });
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
