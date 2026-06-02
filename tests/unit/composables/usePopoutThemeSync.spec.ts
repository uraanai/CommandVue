import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __popoutWindowCountForTests,
  initPopoutThemeSync,
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
    expect(dst.getAttribute("style")).toContain("--color-surface: rgb(1, 2, 3)");
    expect(dst.getAttribute("style")).toContain("--color-accent-600: red");

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
    await new Promise((r) => setTimeout(r, 0)); // flush the MutationObserver microtask

    const dst = win.document.documentElement;
    expect(dst.getAttribute("data-theme")).toBe("light");
    expect(dst.getAttribute("style")).toContain("--color-surface: rgb(9, 9, 9)");

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
