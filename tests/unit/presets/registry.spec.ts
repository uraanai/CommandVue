import type { PresetTypeDefinition } from "@/modules/presets/types";

import { beforeEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";

import { ALL_BUILTIN_PANEL_TYPE_IDS } from "@/modules/panels/builtin";
import {
  __unregisterBuiltinPresetTypesForTests,
  BUILTIN_PRESET_TYPES,
  registerBuiltinPresetTypes,
} from "@/modules/presets/builtin";
import { PANEL_APPEARANCE_PRESET } from "@/modules/presets/panelAppearance";
import { presetTypeRegistry } from "@/modules/presets/registry";

function stubDef(overrides: Partial<PresetTypeDefinition> = {}): PresetTypeDefinition {
  return {
    id: overrides.id ?? "test-preset",
    title: overrides.title ?? "Test",
    description: overrides.description ?? "stub",
    icon: overrides.icon ?? "square",
    applicableTo: overrides.applicableTo ?? ["maplibre"],
    defaultConfig: overrides.defaultConfig ?? {},
    editComponent:
      overrides.editComponent ??
      (() => Promise.resolve(defineComponent({ render: () => h("div") }))),
    applyToPanel: overrides.applyToPanel ?? (() => undefined),
    ...overrides,
  } as PresetTypeDefinition;
}

describe("presetTypeRegistry", () => {
  beforeEach(() => {
    presetTypeRegistry.__resetForTests();
  });

  it("register / get round-trips", () => {
    const def = stubDef({ id: "a" });
    presetTypeRegistry.register(def);
    expect(presetTypeRegistry.get("a")).toBe(def);
  });

  it("re-registering an id throws", () => {
    presetTypeRegistry.register(stubDef({ id: "a" }));
    expect(() => presetTypeRegistry.register(stubDef({ id: "a" }))).toThrow(/already registered/);
  });

  it("listFor filters by applicableTo", () => {
    presetTypeRegistry.register(stubDef({ id: "maps-only", applicableTo: ["maplibre"] }));
    presetTypeRegistry.register(stubDef({ id: "all-maps", applicableTo: ["cesium", "maplibre"] }));
    presetTypeRegistry.register(stubDef({ id: "chart-only", applicableTo: ["chart"] }));

    expect(
      presetTypeRegistry
        .listFor("maplibre")
        .map((d) => d.id)
        .sort(),
    ).toEqual(["all-maps", "maps-only"]);
    expect(presetTypeRegistry.listFor("chart").map((d) => d.id)).toEqual(["chart-only"]);
  });
});

describe("registerBuiltinPresetTypes", () => {
  beforeEach(() => {
    __unregisterBuiltinPresetTypesForTests();
  });

  it("registers all four built-in types", () => {
    registerBuiltinPresetTypes();
    const ids = presetTypeRegistry
      .list()
      .map((d) => d.id)
      .sort();
    expect(ids).toEqual(["chart-theme", "map-overlay", "map-style", "panel-appearance"]);
  });

  it("is idempotent", () => {
    registerBuiltinPresetTypes();
    expect(() => registerBuiltinPresetTypes()).not.toThrow();
    expect(presetTypeRegistry.list()).toHaveLength(BUILTIN_PRESET_TYPES.length);
  });

  it("panel-appearance is applicable to EVERY built-in panel type (no drift)", () => {
    registerBuiltinPresetTypes();
    expect(presetTypeRegistry.get("panel-appearance")).toBeDefined();
    // Derived contract: the preset's applicableTo must equal the registered set.
    expect([...PANEL_APPEARANCE_PRESET.applicableTo].sort()).toEqual(
      [...ALL_BUILTIN_PANEL_TYPE_IDS].sort(),
    );
  });

  it("offers panel-appearance for chart and theme-studio panels", () => {
    registerBuiltinPresetTypes();
    expect(presetTypeRegistry.listFor("chart").map((d) => d.id)).toContain("panel-appearance");
    expect(presetTypeRegistry.listFor("theme-studio").map((d) => d.id)).toContain(
      "panel-appearance",
    );
  });
});
