import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the `panel-appearance` preset (Track A C4). The preset reaches
 * the dock group element through the session store's bound DockviewApi, so we
 * mock that store and hand it a real jsdom element to assert the attribute on.
 */

// Hoisted, mutable handle so each test can swap the fake DockviewApi (or null it).
const state = vi.hoisted(() => ({ api: null as unknown }));

vi.mock("@/stores/session", () => ({
  useSessionStore: () => ({ getDockviewApi: () => state.api }),
}));

import {
  applyAppearance,
  PANEL_APPEARANCE_APPLICABLE_TO,
  PANEL_APPEARANCE_PRESET,
  removeAppearance,
} from "@/modules/presets/panelAppearance";

/** A fake DockviewApi whose `getPanel().api.group.element` is `element` (or
 *  whose `getPanel` returns undefined when `element` is null). */
function fakeApiWith(element: HTMLElement | null) {
  return {
    getPanel: () => (element ? { api: { group: { element } } } : undefined),
  };
}

describe("panel-appearance preset", () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement("div");
    state.api = fakeApiWith(element);
  });

  it("applies a variant as the data-cv-appearance attribute", () => {
    applyAppearance("p1", { variant: "raised" });
    expect(element.getAttribute("data-cv-appearance")).toBe("raised");
  });

  it("swapping variants replaces in place (single value, no accumulation)", () => {
    applyAppearance("p1", { variant: "glass" });
    applyAppearance("p1", { variant: "raised" });
    expect(element.getAttribute("data-cv-appearance")).toBe("raised");
  });

  it("removeAppearance clears the attribute", () => {
    applyAppearance("p1", { variant: "bordered" });
    removeAppearance("p1");
    expect(element.getAttribute("data-cv-appearance")).toBeNull();
  });

  it("falls back to flat for an unknown variant", () => {
    applyAppearance("p1", { variant: "bogus" as never });
    expect(element.getAttribute("data-cv-appearance")).toBe("flat");
  });

  it("no-ops (no throw, element untouched) when the DockviewApi is unbound", () => {
    state.api = null;
    expect(() => applyAppearance("p1", { variant: "raised" })).not.toThrow();
    expect(element.getAttribute("data-cv-appearance")).toBeNull();
    expect(() => removeAppearance("p1")).not.toThrow();
  });

  it("no-ops when the panel / group element is not resolvable", () => {
    state.api = fakeApiWith(null);
    expect(() => applyAppearance("p1", { variant: "raised" })).not.toThrow();
    expect(element.getAttribute("data-cv-appearance")).toBeNull();
  });

  it("is applicable to all eleven built-in panel types", () => {
    expect(PANEL_APPEARANCE_APPLICABLE_TO).toHaveLength(11);
    expect(PANEL_APPEARANCE_PRESET.id).toBe("panel-appearance");
    expect(PANEL_APPEARANCE_PRESET.defaultConfig).toEqual({ variant: "flat" });
  });
});
