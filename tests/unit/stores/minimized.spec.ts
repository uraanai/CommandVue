import type { MinimizedEntry } from "@/stores/minimized";

import { beforeEach, describe, expect, it } from "vitest";

import { useMinimizedStore } from "@/stores/minimized";

import { resetForStoreTest } from "./helpers";

/** Minimal tray entry — only `id` matters for the collapse-state behavior here. */
function fakeEntry(id: string): MinimizedEntry {
  return {
    id,
    location: "grid",
    originAnchor: { direction: "right" },
    panels: [],
    activePanelId: id,
    title: id,
  } as MinimizedEntry;
}

describe("useMinimizedStore — tray collapse state (Phase 5b)", () => {
  beforeEach(async () => {
    await resetForStoreTest();
  });

  it("starts collapsed (the tray is out of the way by default)", () => {
    expect(useMinimizedStore().collapsed).toBe(true);
  });

  it("toggleCollapsed is a no-op while the tray is empty (nothing to show)", () => {
    const m = useMinimizedStore();
    m.toggleCollapsed();
    expect(m.collapsed).toBe(true);
  });

  it("toggleCollapsed flips collapse once the tray has entries", () => {
    const m = useMinimizedStore();
    m.entries.push(fakeEntry("a"));
    m.toggleCollapsed();
    expect(m.collapsed).toBe(false); // expanded
    m.toggleCollapsed();
    expect(m.collapsed).toBe(true); // collapsed again
  });

  it("discarding the LAST entry re-collapses the tray (next minimize starts collapsed)", () => {
    const m = useMinimizedStore();
    m.entries.push(fakeEntry("a"), fakeEntry("b"));
    m.toggleCollapsed();
    expect(m.collapsed).toBe(false);

    m.discard("a");
    expect(m.collapsed).toBe(false); // one entry remains → stays expanded
    m.discard("b");
    expect(m.collapsed).toBe(true); // empty → re-collapsed
    expect(m.entries.length).toBe(0);
  });

  it("clear() empties the tray and re-collapses", () => {
    const m = useMinimizedStore();
    m.entries.push(fakeEntry("a"));
    m.toggleCollapsed();
    expect(m.collapsed).toBe(false);

    m.clear();
    expect(m.entries.length).toBe(0);
    expect(m.collapsed).toBe(true);
  });
});
