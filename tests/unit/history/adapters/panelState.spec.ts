import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeSetFloatAlphaCommand, makeUpdatePanelStateCommand } from "@/modules/history/adapters";
import { useHistoryStore } from "@/stores/history";
import { usePanelStateStore } from "@/stores/panelState";
import { useSessionStore } from "@/stores/session";

import { resetForStoreTest } from "../../stores/helpers";

const LAYOUT_ID = "layout-1";
const PANEL_ID = "panel-1";

beforeEach(async () => {
  await resetForStoreTest();
});

async function seedPanel(state: Record<string, unknown>): Promise<void> {
  const ps = usePanelStateStore();
  await ps.loadForLayout(LAYOUT_ID);
  await ps.createPanel({ layoutId: LAYOUT_ID, panelType: "maplibre", state, id: PANEL_ID });
}

describe("panelState adapter — makeUpdatePanelStateCommand", () => {
  it("applies an immer-patch edit and reverts it through the real store + idb", async () => {
    const ps = usePanelStateStore();
    const history = useHistoryStore();
    await seedPanel({ count: 1, nested: { x: "a" } });

    await history.execute(
      makeUpdatePanelStateCommand(PANEL_ID, (d) => {
        d.count = 2;
        (d.nested as { x: string }).x = "b";
      }),
    );
    expect(ps.getState(PANEL_ID)?.state).toEqual({ count: 2, nested: { x: "b" } });

    await history.undo();
    expect(ps.getState(PANEL_ID)?.state).toEqual({ count: 1, nested: { x: "a" } });

    await history.redo();
    expect(ps.getState(PANEL_ID)?.state).toEqual({ count: 2, nested: { x: "b" } });
  });

  it("only touches the keys the recipe changed (other state survives undo)", async () => {
    const ps = usePanelStateStore();
    const history = useHistoryStore();
    await seedPanel({ keep: "me", n: 0 });

    await history.execute(
      makeUpdatePanelStateCommand(PANEL_ID, (d) => {
        d.n = 5;
      }),
    );
    expect(ps.getState(PANEL_ID)?.state).toEqual({ keep: "me", n: 5 });

    await history.undo();
    expect(ps.getState(PANEL_ID)?.state).toEqual({ keep: "me", n: 0 });
  });
});

describe("panelState adapter — makeSetFloatAlphaCommand coalescing", () => {
  it("collapses a rapid opacity drag into ONE undo step that restores the pre-drag baseline", async () => {
    const history = useHistoryStore();
    const session = useSessionStore();

    // setFloatAlpha needs a live dockview group/DOM; stub the two session methods
    // with a simple in-memory alpha so the REAL command + REAL engine-coalescing
    // (keep older undo baseline + newer redo) are what's under test.
    let alpha = 1; // pre-drag baseline
    vi.spyOn(session, "getFloatAlpha").mockImplementation(() => alpha);
    vi.spyOn(session, "setFloatAlpha").mockImplementation(async (_id: string, v: number) => {
      alpha = v;
    });

    // A drag fires many rapid sets in quick succession — same coalesceKey within
    // the 400ms window, so they merge into a single history entry.
    await history.execute(makeSetFloatAlphaCommand(PANEL_ID, 0.8));
    await history.execute(makeSetFloatAlphaCommand(PANEL_ID, 0.5));
    await history.execute(makeSetFloatAlphaCommand(PANEL_ID, 0.3));

    expect(alpha).toBe(0.3);
    expect(history.undoEntries.length).toBe(1); // merged, not three entries

    // A single undo restores the ORIGINAL pre-drag value (older baseline kept),
    // NOT an intermediate 0.8 / 0.5.
    await history.undo();
    expect(alpha).toBe(1);

    // Redo re-applies the FINAL value (newer redo kept).
    await history.redo();
    expect(alpha).toBe(0.3);
  });
});
