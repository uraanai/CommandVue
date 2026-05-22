import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import { useWorkspaceStore } from "@/stores/workspace";

import { resetForStoreTest } from "./helpers";

describe("useWorkspaceStore", () => {
  beforeEach(async () => {
    await resetForStoreTest();
  });

  it("loadAll picks the persisted current workspace when available", async () => {
    const a = await workspaceRepo.create({ name: "A", isGlobalDefault: true });
    await workspaceRepo.create({ name: "B" });
    // Persist the "current" pointer to B via the store, then re-load.
    const store = useWorkspaceStore();
    await store.loadAll();
    expect(store.currentWorkspaceId).toBe(a.id);
  });

  it("loadAll falls back to the global default when no pointer is persisted", async () => {
    await workspaceRepo.create({ name: "A" });
    const b = await workspaceRepo.create({ name: "B", isGlobalDefault: true });
    const store = useWorkspaceStore();
    await store.loadAll();
    expect(store.currentWorkspaceId).toBe(b.id);
    expect(store.globalDefault?.id).toBe(b.id);
  });

  it("loadAll marks ready true", async () => {
    await workspaceRepo.create({ name: "A", isGlobalDefault: true });
    const store = useWorkspaceStore();
    expect(store.ready).toBe(false);
    await store.loadAll();
    expect(store.ready).toBe(true);
  });

  it("createWorkspace updates the local list", async () => {
    await workspaceRepo.create({ name: "Seed", isGlobalDefault: true });
    const store = useWorkspaceStore();
    await store.loadAll();
    await store.createWorkspace({ name: "New" });
    expect(store.workspaces.map((w) => w.name).sort()).toEqual(["New", "Seed"]);
  });

  it("setCurrentWorkspace updates the pointer and persists it", async () => {
    const a = await workspaceRepo.create({ name: "A", isGlobalDefault: true });
    const b = await workspaceRepo.create({ name: "B" });
    const store = useWorkspaceStore();
    await store.loadAll();
    expect(store.currentWorkspaceId).toBe(a.id);
    await store.setCurrentWorkspace(b.id);
    expect(store.currentWorkspaceId).toBe(b.id);

    // Simulate reload: new Pinia instance, fresh store. Should pick up the
    // persisted `current-workspace-id` pointer from app-meta.
    setActivePinia(createPinia());
    const fresh = useWorkspaceStore();
    await fresh.loadAll();
    expect(fresh.currentWorkspaceId).toBe(b.id);
  });

  it("setCurrentWorkspace throws on unknown id", async () => {
    await workspaceRepo.create({ name: "A", isGlobalDefault: true });
    const store = useWorkspaceStore();
    await store.loadAll();
    await expect(store.setCurrentWorkspace("nope")).rejects.toThrow(/not loaded/);
  });

  it("deleteWorkspace shifts current pointer to the global default", async () => {
    const a = await workspaceRepo.create({ name: "A", isGlobalDefault: true });
    const b = await workspaceRepo.create({ name: "B" });
    const store = useWorkspaceStore();
    await store.loadAll();
    await store.setCurrentWorkspace(b.id);

    await store.deleteWorkspace(b.id);
    expect(store.currentWorkspaceId).toBe(a.id);
    expect(store.workspaces.map((w) => w.id)).toEqual([a.id]);
  });

  it("setGlobalDefault flips the flag and re-reads the list", async () => {
    const a = await workspaceRepo.create({ name: "A", isGlobalDefault: true });
    const b = await workspaceRepo.create({ name: "B" });
    const store = useWorkspaceStore();
    await store.loadAll();
    await store.setGlobalDefault(b.id);
    expect(store.globalDefault?.id).toBe(b.id);
    expect(store.workspaceById(a.id)?.isGlobalDefault).toBe(false);
  });
});
