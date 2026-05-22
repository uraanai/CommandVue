import type { PanelDefinition } from "@/modules/panels/types";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

import {
  __unregisterBuiltinPanelsForTests,
  BUILTIN_PANELS,
  registerBuiltinPanels,
} from "@/modules/panels/builtin";
import { panelRegistry } from "@/modules/panels/registry";

function stubDef(overrides: Partial<PanelDefinition> = {}): PanelDefinition {
  return {
    id: overrides.id ?? "test-panel",
    title: overrides.title ?? "Test Panel",
    description: overrides.description ?? "A test panel.",
    icon: overrides.icon ?? "square",
    category: overrides.category ?? "tools",
    component:
      overrides.component ?? (() => Promise.resolve(defineComponent({ render: () => h("div") }))),
    ...overrides,
  };
}

describe("panelRegistry", () => {
  beforeEach(() => {
    panelRegistry.__resetForTests();
  });

  it("registers a definition and returns it via get()", () => {
    const def = stubDef({ id: "a" });
    panelRegistry.register(def);
    expect(panelRegistry.get("a")).toBe(def);
  });

  it("list() returns all registered definitions", () => {
    panelRegistry.register(stubDef({ id: "a" }));
    panelRegistry.register(stubDef({ id: "b" }));
    expect(
      panelRegistry
        .list()
        .map((d) => d.id)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("re-registering an existing id throws", () => {
    panelRegistry.register(stubDef({ id: "a" }));
    expect(() => panelRegistry.register(stubDef({ id: "a" }))).toThrow(/already registered/);
  });

  it("unregister removes a definition and is a no-op on missing ids", () => {
    panelRegistry.register(stubDef({ id: "a" }));
    panelRegistry.unregister("a");
    expect(panelRegistry.get("a")).toBeUndefined();
    expect(() => panelRegistry.unregister("missing")).not.toThrow();
  });

  it("listByCategory groups by category and sorts titles alphabetically", () => {
    panelRegistry.register(stubDef({ id: "m2", title: "Zebra Map", category: "maps" }));
    panelRegistry.register(stubDef({ id: "m1", title: "Alpha Map", category: "maps" }));
    panelRegistry.register(stubDef({ id: "c1", title: "A Chart", category: "charts" }));

    const grouped = panelRegistry.listByCategory();
    expect(grouped.maps.map((d) => d.title)).toEqual(["Alpha Map", "Zebra Map"]);
    expect(grouped.charts.map((d) => d.id)).toEqual(["c1"]);
  });

  it("subscribe fires immediately with the current snapshot and on every change", () => {
    const cb = vi.fn();
    const unsubscribe = panelRegistry.subscribe(cb);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenLastCalledWith([]);

    panelRegistry.register(stubDef({ id: "a" }));
    expect(cb).toHaveBeenCalledTimes(2);

    panelRegistry.unregister("a");
    expect(cb).toHaveBeenCalledTimes(3);

    unsubscribe();
    panelRegistry.register(stubDef({ id: "b" }));
    expect(cb).toHaveBeenCalledTimes(3);
  });
});

describe("registerBuiltinPanels", () => {
  beforeEach(() => {
    __unregisterBuiltinPanelsForTests();
    panelRegistry.__resetForTests();
  });

  it("registers all seven built-in panels with stable ids", () => {
    registerBuiltinPanels();
    const ids = panelRegistry
      .list()
      .map((d) => d.id)
      .sort();
    expect(ids).toEqual([
      "cesium",
      "chart",
      "entities",
      "maplibre",
      "markdown",
      "symbology",
      "telemetry",
    ]);
  });

  it("is idempotent — calling twice does not throw", () => {
    registerBuiltinPanels();
    expect(() => registerBuiltinPanels()).not.toThrow();
    expect(panelRegistry.list()).toHaveLength(BUILTIN_PANELS.length);
  });

  it("each built-in has a metadata bundle (title, description, icon, category, component)", () => {
    registerBuiltinPanels();
    for (const def of panelRegistry.list()) {
      expect(def.title).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.icon).toBeTruthy();
      expect(def.category).toBeTruthy();
      expect(typeof def.component).toBe("function");
    }
  });
});
