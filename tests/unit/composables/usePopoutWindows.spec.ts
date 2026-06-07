import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __popoutWindowCountForTests,
  __resetForTests as resetThemeSync,
} from "@/composables/usePopoutThemeSync";
import {
  __resetForTests as resetWindows,
  trackPopoutWindow,
  untrackPopoutWindow,
  usePopoutWindows,
} from "@/composables/usePopoutWindows";

/** A minimal same-origin "pop-out window": just a detached document + `closed`. */
function makeFakeWindow(): Window {
  const doc = document.implementation.createHTMLDocument("popout");
  return { closed: false, document: doc } as unknown as Window;
}

describe("usePopoutWindows (Track B Phase 6c)", () => {
  beforeEach(() => {
    resetWindows();
    resetThemeSync();
  });

  afterEach(() => {
    resetWindows();
    resetThemeSync();
  });

  it("tracks a window with a stable numeric id for v-for keying", () => {
    const list = usePopoutWindows();
    expect(list.value).toEqual([]);

    const a = makeFakeWindow();
    const b = makeFakeWindow();
    trackPopoutWindow(a);
    trackPopoutWindow(b);

    expect(list.value).toHaveLength(2);
    expect(list.value[0]).toMatchObject({ id: 1, win: a });
    expect(list.value[1]).toMatchObject({ id: 2, win: b });
  });

  it("is idempotent — tracking the same window twice keeps one entry", () => {
    const list = usePopoutWindows();
    const a = makeFakeWindow();
    trackPopoutWindow(a);
    trackPopoutWindow(a);
    expect(list.value).toHaveLength(1);
    expect(list.value[0]!.win).toBe(a);
  });

  it("untracks only the named window, leaving the rest", () => {
    const list = usePopoutWindows();
    const a = makeFakeWindow();
    const b = makeFakeWindow();
    trackPopoutWindow(a);
    trackPopoutWindow(b);

    untrackPopoutWindow(a);
    expect(list.value).toHaveLength(1);
    expect(list.value[0]!.win).toBe(b);
  });

  it("fans the lifecycle out to theme mirroring (register on track, unregister on untrack)", () => {
    const a = makeFakeWindow();
    trackPopoutWindow(a);
    expect(__popoutWindowCountForTests()).toBe(1); // also registered for theme sync

    untrackPopoutWindow(a);
    expect(__popoutWindowCountForTests()).toBe(0);
    expect(usePopoutWindows().value).toHaveLength(0);
  });
});
