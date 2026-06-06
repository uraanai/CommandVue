import type { FontSpec } from "@/types/theme";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetFontLoaderForTests,
  activeFontHrefs,
  buildFontHref,
  ensureFontLoaded,
  familyIsOfflineReady,
} from "@/composables/useFontLoader";
import {
  __resetForTests as resetPopout,
  registerPopoutWindow,
} from "@/composables/usePopoutThemeSync";
import { __clearCatalogCacheForTests } from "@/modules/themes/fontCatalog";

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}
/** A minimal same-origin pop-out: a detached document. */
function makeFakeWindow(): Window {
  return {
    closed: false,
    document: document.implementation.createHTMLDocument("popout"),
  } as unknown as Window;
}
function google(over: Partial<FontSpec> = {}): FontSpec {
  return { family: "Roboto", source: "google", weights: [400, 700], ...over };
}

beforeEach(() => {
  __resetFontLoaderForTests();
  __clearCatalogCacheForTests();
  resetPopout();
  setOnline(true);
  // jsdom lacks document.fonts; stub the Font Loading API (glyph-ready signal).
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load: vi.fn().mockResolvedValue([]) },
  });
});
afterEach(() => {
  __resetFontLoaderForTests();
  resetPopout();
  // @ts-expect-error — remove the stub between tests
  delete document.fonts;
  vi.restoreAllMocks();
});

describe("buildFontHref", () => {
  it("builds the golden css2 URL — ascending weights, ';'-joined, '+' for spaces", () => {
    expect(buildFontHref("Roboto", [700, 400], [400, 700])).toBe(
      "https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap",
    );
    expect(buildFontHref("Open Sans", [400, 600, 700], [400, 600, 700])).toBe(
      "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap",
    );
  });
  it("clamps an off-catalog weight to 400", () => {
    expect(buildFontHref("Roboto", [950], [400, 700])).toBe(
      "https://fonts.googleapis.com/css2?family=Roboto:wght@400&display=swap",
    );
  });
  it("only ever prefixes the googleapis origin and throws on a bad family", () => {
    expect(buildFontHref("Lato", [400], [400])).toMatch(
      /^https:\/\/fonts\.googleapis\.com\/css2\?/,
    );
    expect(() => buildFontHref("Inter');@import url(x)", [400], [400])).toThrow();
  });
});

describe("ensureFontLoaded", () => {
  it("injects exactly one <link> and de-duplicates concurrent calls", async () => {
    const [a, b] = await Promise.all([ensureFontLoaded(google()), ensureFontLoaded(google())]);
    expect(a.status).toBe("loaded");
    expect(b.status).toBe("loaded");
    expect(activeFontHrefs().length).toBe(1);
    const link = document.head.querySelector('link[data-cv-font-key="Roboto"]');
    expect(link?.getAttribute("rel")).toBe("stylesheet");
    expect(link?.getAttribute("crossorigin")).toBe("anonymous");
  });

  it("is a no-op for non-google sources", async () => {
    expect((await ensureFontLoaded({ family: "Menlo", source: "system" })).status).toBe("idle");
    expect(activeFontHrefs().length).toBe(0);
  });

  it("rejects a disallowed family name with status error, injecting nothing", async () => {
    const r = await ensureFontLoaded({ family: "../etc/passwd", source: "google" });
    expect(r.status).toBe("error");
    expect(activeFontHrefs().length).toBe(0);
  });

  it("offline + curated → loaded with no link (renders from the bundled face)", async () => {
    setOnline(false);
    expect(await ensureFontLoaded(google({ family: "Roboto" }))).toEqual({
      status: "loaded",
      href: null,
    });
    expect(activeFontHrefs().length).toBe(0);
  });

  it("offline + non-curated → offline-fallback with no link (system stack renders)", async () => {
    setOnline(false);
    expect(await ensureFontLoaded(google({ family: "Poppins" }))).toEqual({
      status: "offline-fallback",
      href: null,
    });
    expect(activeFontHrefs().length).toBe(0);
  });

  it("mirrors the font link into an already-open pop-out", async () => {
    const win = makeFakeWindow();
    registerPopoutWindow(win);
    await ensureFontLoaded(google({ family: "Roboto" }));
    expect(win.document.head.querySelector('link[data-cv-font-key="Roboto"]')).not.toBeNull();
  });
});

describe("familyIsOfflineReady", () => {
  it("reflects the curated set", () => {
    expect(familyIsOfflineReady("Roboto")).toBe(true);
    expect(familyIsOfflineReady("Open Sans")).toBe(true);
    expect(familyIsOfflineReady("Poppins")).toBe(false);
  });
});
