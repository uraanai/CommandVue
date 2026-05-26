import type { Theme } from "@/types/theme";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyTheme, clearTheme } from "@/modules/themes/apply";

function fixture(id: string, tokens: Record<string, string>): Theme {
  const now = new Date().toISOString();
  return {
    id,
    name: id,
    description: "",
    author: "",
    isBuiltIn: false,
    mode: "light",
    density: "comfortable",
    tokens,
    createdAt: now,
    updatedAt: now,
  };
}

describe("applyTheme / clearTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme-id");
    document.documentElement.removeAttribute("data-theme-applied");
    document.documentElement.removeAttribute("data-density");
    document.documentElement.style.cssText = "";
  });

  afterEach(() => clearTheme());

  it("writes token overrides as CSS variables on :root", () => {
    applyTheme(
      fixture("alpha", {
        "color-surface-base": "#ff0000",
        "color-text-primary": "#00ff00",
      }),
    );
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--color-surface-base")).toBe("#ff0000");
    expect(root.style.getPropertyValue("--color-text-primary")).toBe("#00ff00");
  });

  it("sets the three identity attributes", () => {
    applyTheme(fixture("alpha", { "color-surface-base": "#fff" }));
    const root = document.documentElement;
    expect(root.getAttribute("data-theme-id")).toBe("alpha");
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(root.getAttribute("data-density")).toBe("comfortable");
  });

  it("removes stale keys when a new theme is applied", () => {
    applyTheme(
      fixture("alpha", {
        "color-surface-base": "#aaa",
        "color-text-primary": "#bbb",
      }),
    );
    applyTheme(
      fixture("beta", {
        "color-surface-base": "#ccc",
        // Note: no `color-text-primary` — should be cleared.
      }),
    );
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--color-surface-base")).toBe("#ccc");
    expect(root.style.getPropertyValue("--color-text-primary")).toBe("");
  });

  it("tracks applied keys via data-theme-applied attribute", () => {
    applyTheme(
      fixture("alpha", {
        "color-surface-base": "#fff",
        "color-text-primary": "#000",
      }),
    );
    const raw = document.documentElement.getAttribute("data-theme-applied");
    const parsed = JSON.parse(raw ?? "[]") as string[];
    expect(parsed.sort()).toEqual(["color-surface-base", "color-text-primary"]);
  });

  it("clearTheme removes overrides and identity attributes", () => {
    applyTheme(fixture("alpha", { "color-surface-base": "#fff" }));
    clearTheme();
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--color-surface-base")).toBe("");
    expect(root.getAttribute("data-theme-id")).toBeNull();
    expect(root.getAttribute("data-density")).toBeNull();
    expect(root.getAttribute("data-theme-applied")).toBeNull();
  });

  it("clearTheme preserves data-theme (owned by useTheme)", () => {
    applyTheme(fixture("alpha", { "color-surface-base": "#fff" }));
    clearTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("re-applying the same theme is safe", () => {
    const t = fixture("alpha", { "color-surface-base": "#fff" });
    applyTheme(t);
    applyTheme(t);
    expect(document.documentElement.style.getPropertyValue("--color-surface-base")).toBe("#fff");
  });
});
