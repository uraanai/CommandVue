import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __popoutWindowCountForTests,
  __resetForTests,
  initPopoutThemeSync,
  injectFontLinkIntoWindow,
  mirrorFontLinkToAllPopouts,
  registerPopoutWindow,
  unregisterPopoutWindow,
} from "@/composables/usePopoutThemeSync";

/** A minimal same-origin "pop-out window": just a detached document. */
function makeFakeWindow(): Window {
  const doc = document.implementation.createHTMLDocument("popout");
  return { closed: false, document: doc } as unknown as Window;
}

describe("usePopoutThemeSync (Track B Phase 6a)", () => {
  beforeEach(() => {
    __resetForTests(); // drop any windows leaked by a prior (failed) test
    const html = document.documentElement;
    html.setAttribute("data-theme", "dark");
    html.setAttribute("data-density", "compact");
    html.setAttribute("style", "--color-surface: rgb(1, 2, 3); --color-accent-600: red;");
  });

  afterEach(() => {
    const html = document.documentElement;
    html.removeAttribute("data-theme");
    html.removeAttribute("data-theme-id");
    html.removeAttribute("data-density");
    html.removeAttribute("style");
  });

  it("registerPopoutWindow mirrors the opener's theme attrs + inline tokens immediately", () => {
    const win = makeFakeWindow();
    registerPopoutWindow(win);
    expect(__popoutWindowCountForTests()).toBe(1);

    const dst = win.document.documentElement;
    expect(dst.getAttribute("data-theme")).toBe("dark");
    expect(dst.getAttribute("data-density")).toBe("compact");
    expect(dst.style.getPropertyValue("--color-surface")).toBe("rgb(1, 2, 3)");
    expect(dst.style.getPropertyValue("--color-accent-600")).toBe("red");

    unregisterPopoutWindow(win);
    expect(__popoutWindowCountForTests()).toBe(0);
  });

  it("re-syncs an open pop-out when the opener's theme changes (the live observer)", async () => {
    initPopoutThemeSync(); // idempotent module-singleton observer
    const win = makeFakeWindow();
    registerPopoutWindow(win);

    // Flip the opener to light + a different token — the observer should mirror it.
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.setAttribute("style", "--color-surface: rgb(9, 9, 9);");
    // Flush the MutationObserver microtask AND the rAF-coalesced sync (A2a).
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

    const dst = win.document.documentElement;
    expect(dst.getAttribute("data-theme")).toBe("light");
    expect(dst.style.getPropertyValue("--color-surface")).toBe("rgb(9, 9, 9)");

    unregisterPopoutWindow(win);
  });

  it("drops a window that reports closed mid-sync (no leak)", () => {
    const win = makeFakeWindow();
    registerPopoutWindow(win);
    expect(__popoutWindowCountForTests()).toBe(1);

    (win as unknown as { closed: boolean }).closed = true;
    // A re-register triggers a sync; the closed window is pruned by syncWindow.
    registerPopoutWindow(win);
    expect(__popoutWindowCountForTests()).toBe(0);
  });
});

describe("usePopoutThemeSync — font-face mirroring (C3)", () => {
  beforeEach(() => __resetForTests());
  afterEach(() => __resetForTests());

  it("mirrors a newly-registered font link into every open pop-out", () => {
    const win = makeFakeWindow();
    registerPopoutWindow(win);
    mirrorFontLinkToAllPopouts("https://fonts.googleapis.com/css2?family=Roboto", "Roboto");
    const link = win.document.head.querySelector('link[data-cv-font-key="Roboto"]');
    expect(link?.getAttribute("rel")).toBe("stylesheet");
    expect(link?.getAttribute("crossorigin")).toBe("anonymous");
  });

  it("backfills already-registered fonts into a pop-out opened later", () => {
    // Font registered BEFORE the pop-out opens.
    mirrorFontLinkToAllPopouts("https://fonts.googleapis.com/css2?family=Open+Sans", "Open Sans");
    const win = makeFakeWindow();
    registerPopoutWindow(win);
    expect(win.document.head.querySelector('link[data-cv-font-key="Open Sans"]')).not.toBeNull();
  });

  it("de-duplicates by font key (one link even if mirrored twice)", () => {
    const win = makeFakeWindow();
    registerPopoutWindow(win);
    mirrorFontLinkToAllPopouts("https://fonts.googleapis.com/css2?family=Lora", "Lora");
    mirrorFontLinkToAllPopouts("https://fonts.googleapis.com/css2?family=Lora", "Lora");
    expect(win.document.head.querySelectorAll('link[data-cv-font-key="Lora"]').length).toBe(1);
  });

  it("injectFontLinkIntoWindow no-ops on a closed window", () => {
    const win = makeFakeWindow();
    (win as unknown as { closed: boolean }).closed = true;
    injectFontLinkIntoWindow(win, "https://fonts.googleapis.com/css2?family=Lato", "Lato");
    expect(win.document.head.querySelector("link")).toBeNull();
  });
});
