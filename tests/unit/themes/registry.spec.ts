import type { Theme } from "@/types/theme";

import { afterEach, describe, expect, it } from "vitest";

import { __unregisterBuiltinThemesForTests, registerBuiltinThemes } from "@/modules/themes/builtin";
import { themeRegistry } from "@/modules/themes/registry";

function makeTheme(overrides: Partial<Theme> = {}): Theme {
  const now = new Date().toISOString();
  return {
    id: "test",
    name: "Test",
    description: "Test fixture",
    author: "tests",
    isBuiltIn: false,
    mode: "light",
    density: "comfortable",
    tokens: { "color-surface-base": "#fff" },
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

  it("listBuiltIn filters by isBuiltIn", () => {
    themeRegistry.register(makeTheme({ id: "core", isBuiltIn: true }));
    themeRegistry.register(makeTheme({ id: "custom", isBuiltIn: false }));
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
