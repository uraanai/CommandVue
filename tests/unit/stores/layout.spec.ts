import { beforeEach, describe, expect, it } from "vitest";

import { layoutRepo } from "@/modules/storage/layoutRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import { useLayoutStore } from "@/stores/layout";

import { resetForStoreTest } from "./helpers";

describe("useLayoutStore", () => {
  beforeEach(async () => {
    await resetForStoreTest();
  });

  it("loadForWorkspace falls back to the workspace defaultLayoutId when no pointer is persisted", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const l1 = await layoutRepo.create({ workspaceId: ws.id, name: "L1" });
    const l2 = await layoutRepo.create({ workspaceId: ws.id, name: "L2" });
    await workspaceRepo.update(ws.id, { defaultLayoutId: l2.id });

    const store = useLayoutStore();
    await store.loadForWorkspace(ws.id);

    expect(store.layouts.map((l) => l.id).sort()).toEqual([l1.id, l2.id].sort());
    expect(store.currentLayoutId).toBe(l2.id);
  });

  it("loadForWorkspace picks the first layout when workspace has no default", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const l1 = await layoutRepo.create({ workspaceId: ws.id, name: "L1" });
    await layoutRepo.create({ workspaceId: ws.id, name: "L2" });

    const store = useLayoutStore();
    await store.loadForWorkspace(ws.id);
    expect(store.currentLayoutId).toBe(l1.id);
  });

  it("createLayout includes the new layout when it belongs to the current workspace", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    await layoutRepo.create({ workspaceId: ws.id, name: "L1" });
    const store = useLayoutStore();
    await store.loadForWorkspace(ws.id);
    await store.createLayout({ workspaceId: ws.id, name: "L2" });
    expect(store.layouts.map((l) => l.name).sort()).toEqual(["L1", "L2"]);
  });

  it("deleteLayout shifts currentLayoutId when the active layout is removed", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const l1 = await layoutRepo.create({ workspaceId: ws.id, name: "L1" });
    const l2 = await layoutRepo.create({ workspaceId: ws.id, name: "L2" });
    const store = useLayoutStore();
    await store.loadForWorkspace(ws.id);
    await store.setCurrentLayout(l2.id);

    await store.deleteLayout(l2.id);
    expect(store.currentLayoutId).toBe(l1.id);
  });

  it("duplicateLayout reloads the workspace list and returns the new layout", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const l1 = await layoutRepo.create({ workspaceId: ws.id, name: "L1" });
    const store = useLayoutStore();
    await store.loadForWorkspace(ws.id);
    const dup = await store.duplicateLayout(l1.id);
    expect(dup.id).not.toBe(l1.id);
    expect(store.layouts).toHaveLength(2);
  });

  it("setCurrentLayout throws on unknown id", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    await layoutRepo.create({ workspaceId: ws.id, name: "L1" });
    const store = useLayoutStore();
    await store.loadForWorkspace(ws.id);
    await expect(store.setCurrentLayout("nope")).rejects.toThrow(/not loaded/);
  });

  it("renameLayout updates the entry in-place", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const l1 = await layoutRepo.create({ workspaceId: ws.id, name: "Old" });
    const store = useLayoutStore();
    await store.loadForWorkspace(ws.id);
    await store.renameLayout(l1.id, { name: "New" });
    expect(store.layouts[0]?.name).toBe("New");
  });
});
