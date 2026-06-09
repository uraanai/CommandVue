import { describe, expect, it } from "vitest";

import { capturePatches, makePatchCommand } from "@/modules/history/patches";

describe("capturePatches", () => {
  it("captures forward + inverse patches for a nested mutation, leaving the base untouched", () => {
    const base = { panel: { title: "A", nested: { count: 1 } }, tags: ["x"] };

    const { next, patches, inversePatches } = capturePatches(base, (draft) => {
      draft.panel.nested.count = 2;
      draft.tags.push("y");
    });

    // forward result reflects the mutation
    expect(next.panel.nested.count).toBe(2);
    expect(next.tags).toEqual(["x", "y"]);
    // base is immutable — produceWithPatches never mutates the input
    expect(base.panel.nested.count).toBe(1);
    expect(base.tags).toEqual(["x"]);
    // both patch sets were captured
    expect(patches.length).toBeGreaterThan(0);
    expect(inversePatches.length).toBeGreaterThan(0);
  });
});

describe("makePatchCommand", () => {
  it("redo applies forward patches and undo applies inverse — both through read()/write()", async () => {
    // a mutable holder standing in for a real store action (the read/write seam)
    let store: Record<string, unknown> = { count: 1, label: "a" };
    const { patches, inversePatches } = capturePatches(store, (d) => {
      d.count = 2;
      d.label = "b";
    });

    const cmd = makePatchCommand({
      label: "Edit",
      scope: "panel-state",
      patches,
      inversePatches,
      read: () => store,
      write: (next) => {
        store = next as Record<string, unknown>;
      },
    });

    await cmd.redo();
    expect(store).toEqual({ count: 2, label: "b" });

    await cmd.undo();
    expect(store).toEqual({ count: 1, label: "a" });

    // replaying redo returns to the forward state (idempotent replay from baseline)
    await cmd.redo();
    expect(store).toEqual({ count: 2, label: "b" });
  });

  it("carries label, scope, category, a generated id, and passes through coalesceKey + meta", () => {
    const cmd = makePatchCommand({
      label: "Edit panel",
      scope: "panel-state",
      category: "update",
      patches: [],
      inversePatches: [],
      read: () => ({}),
      write: () => {},
      coalesceKey: "panelState:p1:alpha",
      meta: { panelId: "p1" },
    });

    expect(cmd.label).toBe("Edit panel");
    expect(cmd.scope).toBe("panel-state");
    expect(cmd.category).toBe("update");
    expect(typeof cmd.id).toBe("string");
    expect(cmd.id.length).toBeGreaterThan(0);
    expect(cmd.coalesceKey).toBe("panelState:p1:alpha");
    expect(cmd.meta).toEqual({ panelId: "p1" });
  });
});
