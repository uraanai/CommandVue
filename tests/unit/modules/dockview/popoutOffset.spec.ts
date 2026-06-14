import { describe, expect, it } from "vitest";

import {
  correctPopoutRestoreOffset,
  type DockviewStateLike,
} from "@/modules/dockview/popoutOffset";

describe("correctPopoutRestoreOffset", () => {
  it("subtracts the main-window origin from each pop-out position so dockview's re-addition cancels", () => {
    const ORIGIN_X = 100;
    const ORIGIN_Y = 40;
    const saved = {
      grid: { root: "serialized-grid" },
      floatingGroups: [{ data: { id: "float" } }],
      popoutGroups: [
        { data: { id: "g1" }, position: { left: 2000, top: 300, width: 800, height: 600 } },
        { data: { id: "g2" }, position: { left: -1440, top: 0, width: 1024, height: 768 } },
      ],
    };

    const corrected = correctPopoutRestoreOffset(saved, ORIGIN_X, ORIGIN_Y);

    // left/top reduced by the origin; width/height + sibling fields untouched.
    expect(corrected.popoutGroups[0]!.position).toEqual({
      left: 1900,
      top: 260,
      width: 800,
      height: 600,
    });
    expect(corrected.popoutGroups[1]!.position).toEqual({
      left: -1540,
      top: -40,
      width: 1024,
      height: 768,
    });
    expect(corrected.popoutGroups[0]!.data).toEqual({ id: "g1" });
    // The rest of the dockview state is preserved verbatim.
    expect(corrected.grid).toEqual(saved.grid);
    expect(corrected.floatingGroups).toEqual(saved.floatingGroups);

    // Core invariant: dockview re-adds the origin on restore → the window lands
    // at its true saved absolute coordinates.
    expect(corrected.popoutGroups[0]!.position!.left + ORIGIN_X).toBe(2000);
    expect(corrected.popoutGroups[0]!.position!.top + ORIGIN_Y).toBe(300);
  });

  it("does not mutate the input blob", () => {
    const saved = {
      popoutGroups: [{ position: { left: 2000, top: 300, width: 800, height: 600 } }],
    };
    const snapshot = structuredClone(saved);
    correctPopoutRestoreOffset(saved, 100, 40);
    expect(saved).toEqual(snapshot);
  });

  it("is a no-op (same reference) when the main window is at the screen origin", () => {
    const saved = {
      popoutGroups: [{ position: { left: 2000, top: 300, width: 800, height: 600 } }],
    };
    expect(correctPopoutRestoreOffset(saved, 0, 0)).toBe(saved);
  });

  it("is a no-op (same reference) when there are no pop-out groups", () => {
    const noField: DockviewStateLike = {};
    expect(correctPopoutRestoreOffset(noField, 100, 40)).toBe(noField);

    const empty: DockviewStateLike = { popoutGroups: [] };
    expect(correctPopoutRestoreOffset(empty, 100, 40)).toBe(empty);
  });

  it("passes through a pop-out group whose position is null", () => {
    const saved = {
      popoutGroups: [
        { position: null },
        { position: { left: 500, top: 200, width: 400, height: 300 } },
      ],
    };
    const corrected = correctPopoutRestoreOffset(saved, 100, 40);
    expect(corrected.popoutGroups[0]!.position).toBeNull();
    expect(corrected.popoutGroups[1]!.position).toEqual({
      left: 400,
      top: 160,
      width: 400,
      height: 300,
    });
  });
});
