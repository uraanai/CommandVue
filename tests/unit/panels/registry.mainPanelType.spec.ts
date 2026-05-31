import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BUILTIN_PANELS,
  __unregisterBuiltinPanelsForTests,
  registerBuiltinPanels,
} from "@/modules/panels/builtin";
import { panelRegistry } from "@/modules/panels/registry";

describe("panelRegistry.mainPanelType", () => {
  beforeEach(() => {
    panelRegistry.__resetForTests();
    __unregisterBuiltinPanelsForTests();
  });
  afterEach(() => {
    panelRegistry.__resetForTests();
    __unregisterBuiltinPanelsForTests();
  });

  it("returns undefined when no panel is flagged mainPane", () => {
    panelRegistry.register({
      id: "alpha",
      title: "Alpha",
      description: "",
      icon: "box",
      category: "tools",
      component: () => Promise.resolve({}),
    });
    expect(panelRegistry.mainPanelType()).toBeUndefined();
  });

  it("returns the id of the first mainPane-flagged definition", () => {
    panelRegistry.register({
      id: "alpha",
      title: "Alpha",
      description: "",
      icon: "box",
      category: "tools",
      component: () => Promise.resolve({}),
    });
    panelRegistry.register({
      id: "beta",
      title: "Beta",
      description: "",
      icon: "box",
      category: "maps",
      mainPane: true,
      component: () => Promise.resolve({}),
    });
    expect(panelRegistry.mainPanelType()).toBe("beta");
  });

  it("the built-in cesium panel is flagged mainPane (static array)", () => {
    const cesium = BUILTIN_PANELS.find((d) => d.id === "cesium");
    expect(cesium?.mainPane).toBe(true);
  });

  it("registerBuiltinPanels makes cesium the registry main type", () => {
    registerBuiltinPanels();
    expect(panelRegistry.mainPanelType()).toBe("cesium");
  });
});
