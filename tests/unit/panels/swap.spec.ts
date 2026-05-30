import type { DockviewApi, DockviewPanelApi } from "dockview-vue";

import { describe, expect, it, vi } from "vitest";

import { swapPanelComponent } from "@/modules/panels/swap";

/**
 * `swapPanelComponent` is a thin imperative wrapper over Dockview's api. The
 * regression it guards is ordering: Dockview 6 rejects a duplicate panel id at
 * `addPanel` time, so the old panel must be `close()`d before the replacement
 * is added. We assert that order plus the location-resolution branches with
 * lightweight fakes — mounting a real Dockview instance isn't worth it here.
 */

interface Fakes {
  dockApi: DockviewApi;
  panelApi: DockviewPanelApi;
  calls: string[];
  addPanel: ReturnType<typeof vi.fn>;
}

function makeFakes(opts: { groupId: string; groupsAfterClose: string[] }): Fakes {
  const calls: string[] = [];
  const addPanel = vi.fn(() => {
    calls.push("addPanel");
  });
  // `groups` is read AFTER close(); reflect the post-close world.
  const dockApi = {
    addPanel,
    get groups() {
      return opts.groupsAfterClose.map((id) => ({ id }));
    },
  } as unknown as DockviewApi;

  const panelApi = {
    id: "panel-1",
    group: { id: opts.groupId },
    close: vi.fn(() => {
      calls.push("close");
    }),
  } as unknown as DockviewPanelApi;

  return { dockApi, panelApi, calls, addPanel };
}

/** First `addPanel` options object, asserted present (keeps strict TS happy). */
function firstAddPanelArg(addPanel: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const arg = addPanel.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
  expect(arg).toBeDefined();
  return arg as Record<string, unknown>;
}

describe("swapPanelComponent", () => {
  it("closes the old panel BEFORE adding the replacement (frees the id)", () => {
    const { dockApi, panelApi, calls } = makeFakes({
      groupId: "g1",
      groupsAfterClose: ["g1"],
    });
    swapPanelComponent(dockApi, panelApi, { component: "briefing", title: "Briefing" });
    expect(calls).toEqual(["close", "addPanel"]);
  });

  it("re-adds with the same id and the chosen component + title", () => {
    const { dockApi, panelApi, addPanel } = makeFakes({
      groupId: "g1",
      groupsAfterClose: ["g1"],
    });
    swapPanelComponent(dockApi, panelApi, { component: "briefing", title: "Briefing" });
    expect(addPanel).toHaveBeenCalledTimes(1);
    expect(firstAddPanelArg(addPanel)).toMatchObject({
      id: "panel-1",
      component: "briefing",
      title: "Briefing",
    });
  });

  it("re-joins the original group when it survived the close", () => {
    const { dockApi, panelApi, addPanel } = makeFakes({
      groupId: "g1",
      groupsAfterClose: ["g1", "g2"],
    });
    swapPanelComponent(dockApi, panelApi, { component: "briefing", title: "Briefing" });
    const arg = firstAddPanelArg(addPanel);
    expect(arg).toMatchObject({
      position: { referenceGroup: "g1", direction: "within" },
    });
    expect(arg.floating).toBeUndefined();
  });

  it("re-adds floating when the group was disposed with its last panel", () => {
    const { dockApi, panelApi, addPanel } = makeFakes({
      groupId: "g1",
      groupsAfterClose: ["g2"], // g1 gone — the empty placeholder was alone
    });
    swapPanelComponent(dockApi, panelApi, { component: "briefing", title: "Briefing" });
    const arg = firstAddPanelArg(addPanel);
    expect(arg).toMatchObject({ floating: true });
    expect(arg.position).toBeUndefined();
  });
});
