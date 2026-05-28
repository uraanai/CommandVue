import type { Theme } from "@/types/theme";

import { afterEach, describe, expect, it } from "vitest";

import { __unregisterBuiltinThemesForTests, registerBuiltinThemes } from "@/modules/themes/builtin";
import { themeRegistry } from "@/modules/themes/registry";

function makeTheme(overrides: Partial<Theme> = {}): Theme {
  const now = Date.now();
  return {
    id: "test",
    name: "Test",
    description: "Test fixture",
    author: "tests",
    source: "user",
    mode: "light",
    density: "comfortable",
    tokens: { "--color-surface-base": "#fff" },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("themeRegistry", () => {
  afterEach(() => {
    themeRegistry.__resetForTests();
  });

  it("registers and retrieves themes by id", () => {
    const theme = makeTheme({ id: "alpha" });
    themeRegistry.register(theme);
    expect(themeRegistry.get("alpha")).toBe(theme);
    expect(themeRegistry.get("missing")).toBeUndefined();
  });

  it("throws when registering a duplicate id", () => {
    themeRegistry.register(makeTheme({ id: "dup" }));
    expect(() => themeRegistry.register(makeTheme({ id: "dup" }))).toThrow(/already registered/i);
  });

  it("unregisters cleanly", () => {
    themeRegistry.register(makeTheme({ id: "alpha" }));
    themeRegistry.unregister("alpha");
    expect(themeRegistry.get("alpha")).toBeUndefined();
  });

  it("listBuiltIn filters by source", () => {
    themeRegistry.register(makeTheme({ id: "core", source: "built-in" }));
    themeRegistry.register(makeTheme({ id: "custom", source: "generated" }));
    const builtIns = themeRegistry.listBuiltIn();
    expect(builtIns.map((t) => t.id)).toEqual(["core"]);
  });

  it("listByMode filters by mode", () => {
    themeRegistry.register(makeTheme({ id: "l", mode: "light" }));
    themeRegistry.register(makeTheme({ id: "d", mode: "dark" }));
    expect(themeRegistry.listByMode("light").map((t) => t.id)).toEqual(["l"]);
    expect(themeRegistry.listByMode("dark").map((t) => t.id)).toEqual(["d"]);
  });

  it("subscribe invokes listener immediately with current state", () => {
    themeRegistry.register(makeTheme({ id: "alpha" }));
    let snapshot: readonly Theme[] = [];
    const unsub = themeRegistry.subscribe((list) => {
      snapshot = list;
    });
    expect(snapshot.map((t) => t.id)).toEqual(["alpha"]);
    unsub();
  });

  it("subscribe fires on subsequent register / unregister", () => {
    const seen: number[] = [];
    const unsub = themeRegistry.subscribe((list) => seen.push(list.length));
    themeRegistry.register(makeTheme({ id: "alpha" }));
    themeRegistry.register(makeTheme({ id: "beta" }));
    themeRegistry.unregister("alpha");
    unsub();
    expect(seen).toEqual([0, 1, 2, 1]);
  });

  // -- Phase C: source filters + loadFromRepo --

  it("listCustom returns everything that isn't built-in", () => {
    themeRegistry.register(makeTheme({ id: "core", source: "built-in" }));
    themeRegistry.register(makeTheme({ id: "gen", source: "generated" }));
    themeRegistry.register(makeTheme({ id: "imp", source: "imported" }));
    themeRegistry.register(makeTheme({ id: "usr", source: "user" }));
    expect(
      themeRegistry
        .listCustom()
        .map((t) => t.id)
        .sort(),
    ).toEqual(["gen", "imp", "usr"]);
  });

  it("listGenerated and listImported partition by source", () => {
    themeRegistry.register(makeTheme({ id: "g1", source: "generated" }));
    themeRegistry.register(makeTheme({ id: "g2", source: "generated" }));
    themeRegistry.register(makeTheme({ id: "i1", source: "imported" }));
    expect(
      themeRegistry
        .listGenerated()
        .map((t) => t.id)
        .sort(),
    ).toEqual(["g1", "g2"]);
    expect(themeRegistry.listImported().map((t) => t.id)).toEqual(["i1"]);
  });

  describe("loadFromRepo", () => {
    it("registers every theme the fetcher returns", async () => {
      const persisted = [
        makeTheme({ id: "01PERSIST00000000000000001", source: "generated" }),
        makeTheme({ id: "01PERSIST00000000000000002", source: "imported" }),
      ];
      await themeRegistry.loadFromRepo(async () => persisted);
      expect(
        themeRegistry
          .list()
          .map((t) => t.id)
          .sort(),
      ).toEqual(["01PERSIST00000000000000001", "01PERSIST00000000000000002"]);
    });

    it("skips ids already registered (built-ins win)", async () => {
      themeRegistry.register(
        makeTheme({ id: "compact-light", source: "built-in", name: "Built-in Compact Light" }),
      );
      await themeRegistry.loadFromRepo(async () => [
        makeTheme({ id: "compact-light", source: "user", name: "Ghost should NOT overwrite" }),
      ]);
      expect(themeRegistry.get("compact-light")?.name).toBe("Built-in Compact Light");
    });

    it("notifies subscribers only when at least one theme was added", async () => {
      const seen: number[] = [];
      themeRegistry.subscribe((list) => seen.push(list.length));
      await themeRegistry.loadFromRepo(async () => []);
      // initial subscribe snapshot + no extra notify (nothing added)
      expect(seen).toEqual([0]);
      await themeRegistry.loadFromRepo(async () => [makeTheme({ id: "fresh" })]);
      expect(seen).toEqual([0, 1]);
    });
  });
});

describe("registerBuiltinThemes", () => {
  afterEach(() => {
    __unregisterBuiltinThemesForTests();
  });

  it("registers exactly six built-in themes with the expected ids", () => {
    registerBuiltinThemes();
    const ids = themeRegistry.listBuiltIn().map((t) => t.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids)).toEqual(
      new Set([
        "compact-light",
        "compact-dark",
        "command-center-light",
        "command-center-dark",
        "admin-panel-light",
        "admin-panel-dark",
      ]),
    );
  });

  it("each pair has matching light/dark variants", () => {
    registerBuiltinThemes();
    for (const base of ["compact", "command-center", "admin-panel"]) {
      const light = themeRegistry.get(`${base}-light`);
      const dark = themeRegistry.get(`${base}-dark`);
      expect(light?.mode).toBe("light");
      expect(dark?.mode).toBe("dark");
      expect(light?.density).toBe(dark?.density);
    }
  });

  it("is idempotent (second call is a no-op)", () => {
    registerBuiltinThemes();
    registerBuiltinThemes();
    expect(themeRegistry.list()).toHaveLength(6);
  });
});
