import { beforeEach, describe, expect, it } from "vitest";

import { InvariantError, NotFoundError } from "@/modules/storage/errors";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";

import { resetStorage } from "./helpers";

describe("layoutRepo", () => {
  beforeEach(async () => {
    await resetStorage();
  });

  it("creates a layout and returns it", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const layout = await layoutRepo.create({ workspaceId: ws.id, name: "L1" });
    expect(layout.workspaceId).toBe(ws.id);
    expect(layout.panelIds).toEqual([]);
    expect(layout.dockviewState).toBeNull();
  });

  it("listByWorkspace returns only that workspace's layouts, sorted by createdAt", async () => {
    const a = await workspaceRepo.create({ name: "A", isGlobalDefault: true });
    const b = await workspaceRepo.create({ name: "B" });
    const l1 = await layoutRepo.create({ workspaceId: a.id, name: "1" });
    await new Promise((r) => setTimeout(r, 5));
    const l2 = await layoutRepo.create({ workspaceId: a.id, name: "2" });
    await layoutRepo.create({ workspaceId: b.id, name: "other" });

    const result = await layoutRepo.listByWorkspace(a.id);
    expect(result.map((l) => l.id)).toEqual([l1.id, l2.id]);
  });

  it("update merges fields and bumps updatedAt", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const layout = await layoutRepo.create({ workspaceId: ws.id, name: "Old" });
    await new Promise((r) => setTimeout(r, 5));
    const updated = await layoutRepo.update(layout.id, { name: "New" });
    expect(updated.name).toBe("New");
    expect(updated.updatedAt).toBeGreaterThan(layout.updatedAt);
  });

  it("delete refuses to remove the last layout in a workspace", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const solo = await layoutRepo.create({ workspaceId: ws.id, name: "Solo" });
    await expect(layoutRepo.delete(solo.id)).rejects.toBeInstanceOf(InvariantError);
  });

  it("delete cascades panel-states", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const keep = await layoutRepo.create({ workspaceId: ws.id, name: "Keep" });
    const drop = await layoutRepo.create({ workspaceId: ws.id, name: "Drop" });
    const panel = await panelStateRepo.create({ layoutId: drop.id, panelType: "x" });
    const sibling = await panelStateRepo.create({ layoutId: keep.id, panelType: "y" });

    await layoutRepo.delete(drop.id);

    expect(await panelStateRepo.getById(panel.id)).toBeUndefined();
    expect(await panelStateRepo.getById(sibling.id)).toBeDefined();
  });

  it("delete repoints workspace.defaultLayoutId to the oldest surviving layout", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const first = await layoutRepo.create({ workspaceId: ws.id, name: "first" });
    await new Promise((r) => setTimeout(r, 5));
    const second = await layoutRepo.create({ workspaceId: ws.id, name: "second" });
    await workspaceRepo.update(ws.id, { defaultLayoutId: second.id });

    await layoutRepo.delete(second.id);

    const ws2 = await workspaceRepo.getById(ws.id);
    expect(ws2?.defaultLayoutId).toBe(first.id);
  });

  it("delete throws NotFoundError on missing id", async () => {
    await expect(layoutRepo.delete("nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("duplicate deep-clones with fresh ULIDs for layout and every panel", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const layout = await layoutRepo.create({
      workspaceId: ws.id,
      name: "Source",
    });
    const p1 = await panelStateRepo.create({
      layoutId: layout.id,
      panelType: "cesium",
      state: { camera: { lat: 1 } },
    });
    const p2 = await panelStateRepo.create({
      layoutId: layout.id,
      panelType: "maplibre",
      state: { zoom: 4 },
    });
    await layoutRepo.update(layout.id, {
      panelIds: [p1.id, p2.id],
      dockviewState: { panels: { [p1.id]: {}, [p2.id]: {} } },
    });

    const dup = await layoutRepo.duplicate(layout.id);

    expect(dup.id).not.toBe(layout.id);
    expect(dup.name).toBe("Source (copy)");
    expect(dup.panelIds).toHaveLength(2);
    expect(dup.panelIds.some((id) => id === p1.id || id === p2.id)).toBe(false);

    const dupPanels = await panelStateRepo.listByLayout(dup.id);
    expect(dupPanels).toHaveLength(2);
    expect(dupPanels.map((p) => p.panelType).sort()).toEqual(["cesium", "maplibre"]);

    // dockviewState contains the new ids, not the old ones
    const stateStr = JSON.stringify(dup.dockviewState);
    expect(stateStr).not.toContain(p1.id);
    expect(stateStr).not.toContain(p2.id);
    for (const newId of dup.panelIds) {
      expect(stateStr).toContain(newId);
    }
  });

  it("duplicate accepts a custom name", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const layout = await layoutRepo.create({ workspaceId: ws.id, name: "S" });
    const dup = await layoutRepo.duplicate(layout.id, { name: "Custom" });
    expect(dup.name).toBe("Custom");
  });
});
