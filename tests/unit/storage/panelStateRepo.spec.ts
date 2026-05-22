import { beforeEach, describe, expect, it } from "vitest";

import { NotFoundError } from "@/modules/storage/errors";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";

import { resetStorage } from "./helpers";

async function makeLayout() {
  const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
  return layoutRepo.create({ workspaceId: ws.id, name: "L" });
}

describe("panelStateRepo", () => {
  beforeEach(async () => {
    await resetStorage();
  });

  it("creates an empty panel when panelType is null", async () => {
    const layout = await makeLayout();
    const panel = await panelStateRepo.create({ layoutId: layout.id, panelType: null });
    expect(panel.assignmentState).toBe("empty");
    expect(panel.panelType).toBeNull();
    expect(panel.appliedPresetIds).toEqual([]);
  });

  it("creates an assigned panel when panelType is set", async () => {
    const layout = await makeLayout();
    const panel = await panelStateRepo.create({ layoutId: layout.id, panelType: "cesium" });
    expect(panel.assignmentState).toBe("assigned");
    expect(panel.panelType).toBe("cesium");
  });

  it("listByLayout returns only that layout's panels", async () => {
    const a = await makeLayout();
    const ws = await workspaceRepo.getGlobalDefault();
    const b = await layoutRepo.create({ workspaceId: ws!.id, name: "B" });
    await panelStateRepo.create({ layoutId: a.id, panelType: "x" });
    await panelStateRepo.create({ layoutId: a.id, panelType: "y" });
    await panelStateRepo.create({ layoutId: b.id, panelType: "z" });

    const aPanels = await panelStateRepo.listByLayout(a.id);
    expect(aPanels).toHaveLength(2);
  });

  it("update merges fields and bumps updatedAt", async () => {
    const layout = await makeLayout();
    const panel = await panelStateRepo.create({ layoutId: layout.id, panelType: "x" });
    await new Promise((r) => setTimeout(r, 5));
    const updated = await panelStateRepo.update(panel.id, {
      state: { foo: 1 },
      assignmentState: "configured",
    });
    expect(updated.state).toEqual({ foo: 1 });
    expect(updated.assignmentState).toBe("configured");
    expect(updated.updatedAt).toBeGreaterThan(panel.updatedAt);
  });

  it("delete removes a panel", async () => {
    const layout = await makeLayout();
    const panel = await panelStateRepo.create({ layoutId: layout.id, panelType: "x" });
    await panelStateRepo.delete(panel.id);
    expect(await panelStateRepo.getById(panel.id)).toBeUndefined();
  });

  it("delete throws NotFoundError on missing id", async () => {
    await expect(panelStateRepo.delete("nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("bulkDeleteByLayout clears every panel for a layout", async () => {
    const layout = await makeLayout();
    await panelStateRepo.create({ layoutId: layout.id, panelType: "x" });
    await panelStateRepo.create({ layoutId: layout.id, panelType: "y" });
    await panelStateRepo.bulkDeleteByLayout(layout.id);
    expect(await panelStateRepo.listByLayout(layout.id)).toEqual([]);
  });

  it("applyPreset appends a preset id and bumps precedence on re-apply", async () => {
    const layout = await makeLayout();
    const panel = await panelStateRepo.create({ layoutId: layout.id, panelType: "x" });

    const after1 = await panelStateRepo.applyPreset(panel.id, "p-A");
    expect(after1.appliedPresetIds).toEqual(["p-A"]);
    const after2 = await panelStateRepo.applyPreset(panel.id, "p-B");
    expect(after2.appliedPresetIds).toEqual(["p-A", "p-B"]);
    // re-applying p-A moves it to the end (higher precedence)
    const after3 = await panelStateRepo.applyPreset(panel.id, "p-A");
    expect(after3.appliedPresetIds).toEqual(["p-B", "p-A"]);
  });

  it("removePreset drops a preset id", async () => {
    const layout = await makeLayout();
    const panel = await panelStateRepo.create({
      layoutId: layout.id,
      panelType: "x",
      appliedPresetIds: ["p-A", "p-B"],
    });
    const after = await panelStateRepo.removePreset(panel.id, "p-A");
    expect(after.appliedPresetIds).toEqual(["p-B"]);
  });
});
