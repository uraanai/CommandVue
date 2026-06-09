import { beforeEach, describe, expect, it } from "vitest";

import { makeUpdatePanelStateCommand } from "@/modules/history/adapters";
import { useHistoryStore } from "@/stores/history";
import { usePanelStateStore } from "@/stores/panelState";

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
