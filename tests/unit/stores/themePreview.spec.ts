import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { themeRepo } from "@/modules/storage/themeRepo";
import { __unregisterBuiltinThemesForTests, registerBuiltinThemes } from "@/modules/themes/builtin";
import { useThemeStore } from "@/stores/theme";

import { resetForStoreTest } from "./helpers";

// In the test realm APP_ROOT === document.documentElement.
const ROOT = document.documentElement;

beforeEach(async () => {
  await resetForStoreTest();
  registerBuiltinThemes();
  ROOT.removeAttribute("data-theme-applied");
  ROOT.removeAttribute("data-theme-preview-applied");
  ROOT.style.cssText = "";
});

afterEach(() => {
  __unregisterBuiltinThemesForTests();
  ROOT.style.cssText = "";
  ROOT.removeAttribute("data-theme-applied");
  ROOT.removeAttribute("data-theme-preview-applied");
});

describe("theme store — live preview draft (A2a)", () => {
  it("beginPreview + setPreviewToken applies to the top root and tracks the draft", () => {
    const store = useThemeStore();
    store.beginPreview();
    expect(store.isPreviewing).toBe(true);

    store.setPreviewToken("--color-surface-base", "#123456");
    expect(store.previewDraft).toEqual({ "--color-surface-base": "#123456" });
    expect(ROOT.style.getPropertyValue("--color-surface-base")).toBe("#123456");
    expect(JSON.parse(ROOT.getAttribute("data-theme-preview-applied")!)).toContain(
      "--color-surface-base",
    );
  });

  it("resetPreviewToken drops one token from the draft + overlay", () => {
    const store = useThemeStore();
    store.beginPreview();
    store.setPreviewToken("--color-surface-base", "#111");
    store.setPreviewToken("--color-interactive", "#0af");

    store.resetPreviewToken("--color-surface-base");
    expect(store.previewDraft).toEqual({ "--color-interactive": "#0af" });
    expect(ROOT.style.getPropertyValue("--color-surface-base")).toBe("");
    expect(ROOT.style.getPropertyValue("--color-interactive")).toBe("#0af");
  });

  it("cancelPreview discards the draft and re-asserts the committed theme", async () => {
    const store = useThemeStore();
    await store.loadInitial(null); // applies the fallback built-in (compact-light)
    const committedSurface = store.currentTheme!.tokens["--color-surface-base"];

    store.beginPreview();
    store.setPreviewToken("--color-surface-base", "#ff00ff");
    expect(ROOT.style.getPropertyValue("--color-surface-base")).toBe("#ff00ff");

    store.cancelPreview();
    expect(store.isPreviewing).toBe(false);
    expect(store.previewDraft).toEqual({});
    // The committed value is restored in place (no flash to default).
    expect(ROOT.style.getPropertyValue("--color-surface-base")).toBe(committedSurface);
  });

  it("commitPreview persists the draft as overrides on a repo-backed theme", async () => {
    const store = useThemeStore();
    const theme = await themeRepo.create({
      name: "Editable",
      description: "",
      author: "",
      source: "generated",
      mode: "light",
      density: "comfortable",
      base: {
        kind: "generated",
        input: {
          schemaVersion: 2,
          baseColor: "oklch(0.97 0.01 250)",
          accentColor: "oklch(0.6 0.18 250)",
          contrast: 55,
          mode: "light",
          density: "comfortable",
        },
      },
      overrides: {},
    });
    await store.setTheme(theme.id, null);

    store.beginPreview();
    store.setPreviewToken("--color-surface-base", "oklch(0.5 0 0)");
    const saved = await store.commitPreview();

    expect(saved?.overrides["--color-surface-base"]).toBe("oklch(0.5 0 0)");
    expect(store.previewDraft).toEqual({});
    const fetched = await themeRepo.getById(theme.id);
    expect(fetched?.overrides["--color-surface-base"]).toBe("oklch(0.5 0 0)");
    // The resolved cache reflects the override too (write-through).
    expect(fetched?.tokens["--color-surface-base"]).toBe("oklch(0.5 0 0)");
  });

  it("commitPreview throws on a built-in active theme (route to save-as-new)", async () => {
    const store = useThemeStore();
    await store.loadInitial(null); // compact-light (built-in)
    store.beginPreview();
    store.setPreviewToken("--color-surface-base", "#111");
    await expect(store.commitPreview()).rejects.toThrow(/built-in/i);
  });
});
