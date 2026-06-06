import type { FontSpec, GenerationInputV2, Theme } from "@/types/theme";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ensureFontSpecLoaded } from "@/composables/useFontLoader";
import {
  applyTheme,
  applyTokenOverrides,
  clearTheme,
  clearTokenOverrides,
} from "@/modules/themes/apply";

vi.mock("@/composables/useFontLoader", () => ({
  ensureFontSpecLoaded: vi.fn().mockResolvedValue(undefined),
}));

// applyTheme's font hook is a fire-and-forget dynamic import().then(); a macrotask
// tick flushes the import resolution + the .then chain.
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function generatedFixture(fontSpec?: FontSpec): Theme {
  const now = Date.now();
  const input: GenerationInputV2 = {
    schemaVersion: 2,
    baseColor: "oklch(0.98 0.005 250)",
    accentColor: "oklch(0.55 0.18 250)",
    contrast: 50,
    mode: "light",
    density: "comfortable",
    ...(fontSpec ? { fontSpec } : {}),
  };
  return {
    id: "gen",
    name: "gen",
    description: "",
    author: "",
    source: "generated",
    mode: "light",
    density: "comfortable",
    base: { kind: "generated", input },
    overrides: {},
    tokens: { "color-surface-base": "#fff" },
    createdAt: now,
    updatedAt: now,
  };
}

function fixture(id: string, tokens: Record<string, string>): Theme {
  const now = Date.now();
  return {
    id,
    name: id,
    description: "",
    author: "",
    source: "generated",
    mode: "light",
    density: "comfortable",
    base: { kind: "static", tokens },
    overrides: {},
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
    // Keys are normalized to `--`-prefixed form on apply.
    expect(parsed.sort()).toEqual(["--color-surface-base", "--color-text-primary"]);
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

describe("applyTokenOverrides / clearTokenOverrides (live preview — A2a)", () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement("div");
  });

  it("writes overrides onto an EXPLICIT root and tracks them", () => {
    applyTokenOverrides({ "--color-surface-base": "#111", "color-text-primary": "#eee" }, root);
    expect(root.style.getPropertyValue("--color-surface-base")).toBe("#111");
    expect(root.style.getPropertyValue("--color-text-primary")).toBe("#eee"); // bare key normalized
    expect(JSON.parse(root.getAttribute("data-theme-preview-applied")!)).toEqual([
      "--color-surface-base",
      "--color-text-primary",
    ]);
  });

  it("is additive — a second call keeps earlier preview keys", () => {
    applyTokenOverrides({ "--color-surface-base": "#111" }, root);
    applyTokenOverrides({ "--color-interactive": "#0af" }, root);
    expect(root.style.getPropertyValue("--color-surface-base")).toBe("#111");
    expect(root.style.getPropertyValue("--color-interactive")).toBe("#0af");
    expect(JSON.parse(root.getAttribute("data-theme-preview-applied")!)).toEqual([
      "--color-surface-base",
      "--color-interactive",
    ]);
  });

  it("clearTokenOverrides removes the whole preview overlay + attribute", () => {
    applyTokenOverrides({ "--color-surface-base": "#111", "--color-interactive": "#0af" }, root);
    clearTokenOverrides(root);
    expect(root.style.getPropertyValue("--color-surface-base")).toBe("");
    expect(root.style.getPropertyValue("--color-interactive")).toBe("");
    expect(root.getAttribute("data-theme-preview-applied")).toBeNull();
  });

  it("clearTokenOverrides keeps the `except` keys inline (no-flash ordering)", () => {
    applyTokenOverrides({ "--color-surface-base": "#111", "--color-interactive": "#0af" }, root);
    clearTokenOverrides(root, new Set(["--color-interactive"]));
    expect(root.style.getPropertyValue("--color-surface-base")).toBe(""); // preview-only → removed
    expect(root.style.getPropertyValue("--color-interactive")).toBe("#0af"); // committed-owned → kept
    expect(JSON.parse(root.getAttribute("data-theme-preview-applied")!)).toEqual([
      "--color-interactive",
    ]);
  });

  it("operates on the given root only, never document.documentElement", () => {
    applyTokenOverrides({ "--color-surface-base": "#111" }, root);
    expect(document.documentElement.style.getPropertyValue("--color-surface-base")).toBe("");
  });
});

describe("applyTheme reconciles a live preview overlay (no-flash commit)", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme-applied");
    document.documentElement.removeAttribute("data-theme-preview-applied");
    document.documentElement.style.cssText = "";
  });
  afterEach(() => clearTheme());

  it("drops committed keys from the preview tracking so a later clear can't strip them", () => {
    const root = document.documentElement;
    // Preview overlay touches two keys, one of which the committed theme also owns.
    applyTokenOverrides({ "color-surface-base": "#abc", "--color-interactive": "#0af" }, root);
    // Commit a theme that owns surface-base.
    applyTheme(fixture("committed", { "color-surface-base": "#fff" }));
    // surface-base is now committed-owned (dropped from preview tracking);
    // interactive remains a preview-only key.
    expect(JSON.parse(root.getAttribute("data-theme-preview-applied")!)).toEqual([
      "--color-interactive",
    ]);
    // Clearing the preview overlay must NOT remove the committed surface-base.
    clearTokenOverrides(root);
    expect(root.style.getPropertyValue("--color-surface-base")).toBe("#fff");
    expect(root.style.getPropertyValue("--color-interactive")).toBe("");
  });
});

describe("applyTheme — C3 font-load hook", () => {
  beforeEach(() => vi.mocked(ensureFontSpecLoaded).mockClear());
  afterEach(() => clearTheme());

  it("triggers the font loader once for a generated theme with a fontSpec", async () => {
    applyTheme(generatedFixture({ family: "Roboto", source: "google", weights: [400, 700] }));
    await flush();
    expect(vi.mocked(ensureFontSpecLoaded)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(ensureFontSpecLoaded).mock.calls[0]?.[0]).toMatchObject({ family: "Roboto" });
  });

  it("does NOT trigger the loader for a fontless generated theme", async () => {
    applyTheme(generatedFixture());
    await flush();
    expect(vi.mocked(ensureFontSpecLoaded)).not.toHaveBeenCalled();
  });

  it("does NOT trigger the loader for a static theme", async () => {
    applyTheme(fixture("static-one", { "color-surface-base": "#fff" }));
    await flush();
    expect(vi.mocked(ensureFontSpecLoaded)).not.toHaveBeenCalled();
  });
});
