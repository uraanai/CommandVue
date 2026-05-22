import type { DockviewApi } from "dockview-vue";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import { useLayoutStore } from "@/stores/layout";
import { usePanelStateStore } from "@/stores/panelState";
import { __unbindDockviewForTests, useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";

import { resetForStoreTest } from "./helpers";

/**
 * Minimal DockviewApi test double. We only stub the methods session.ts
 * actually calls (`clear`, `addPanel`, `toJSON`, `fromJSON`, `panels`,
 * `onDidLayoutChange`). Everything else throws on access — surfaces
 * accidental usage during a test.
 */
function makeFakeApi(): DockviewApi {
  const panels: { id: string; component: string; title?: string }[] = [];
  const stub = {
    panels,
    clear: vi.fn(() => {
      panels.length = 0;
    }),
    addPanel: vi.fn((p: { id: string; component: string; title?: string }) => {
      panels.push(p);
      return { id: p.id };
    }),
    toJSON: vi.fn(() => ({
      grid: { fake: true },
      panels: Object.fromEntries(panels.map((p) => [p.id, {}])),
    })),
    fromJSON: vi.fn(),
    onDidLayoutChange: vi.fn(() => ({ dispose: () => undefined })),
  };
  return stub as unknown as DockviewApi;
}

async function seedWorkspace() {
  const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
  const layout = await layoutRepo.create({ workspaceId: ws.id, name: "L" });
  const p1 = await panelStateRepo.create({ layoutId: layout.id, panelType: "cesium" });
  const p2 = await panelStateRepo.create({ layoutId: layout.id, panelType: "maplibre" });
  await layoutRepo.update(layout.id, { panelIds: [p1.id, p2.id] });
  await workspaceRepo.update(ws.id, { defaultLayoutId: layout.id });
  return { ws, layout, p1, p2 };
}

describe("useSessionStore", () => {
  beforeEach(async () => {
    await resetForStoreTest();
    __unbindDockviewForTests();
  });

  it("loadLayout throws when Dockview API is not bound", async () => {
    const { layout } = await seedWorkspace();
    const session = useSessionStore();
    await expect(session.loadLayout(layout.id)).rejects.toThrow(/not bound/);
  });

  it("loadLayout rebuilds the dock from panel-states when dockviewState is null", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    expect(api.clear).toHaveBeenCalled();
    expect(api.fromJSON).not.toHaveBeenCalled();
    expect(api.addPanel).toHaveBeenCalledTimes(2);
    const addedIds = vi.mocked(api.addPanel).mock.calls.map((c) => c[0]!.id);
    expect(addedIds).toEqual([p1.id, p2.id]);
    expect(session.loadedLayoutId).toBe(layout.id);
    expect(session.dirty).toBe(false);
  });

  it("loadLayout uses fromJSON when dockviewState is present", async () => {
    const { layout } = await seedWorkspace();
    await layoutRepo.update(layout.id, { dockviewState: { grid: { restored: true } } });

    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    expect(api.fromJSON).toHaveBeenCalledWith({ grid: { restored: true } });
    expect(api.addPanel).not.toHaveBeenCalled();
  });

  it("markDirty / clearDirty toggles the flag", () => {
    const session = useSessionStore();
    expect(session.dirty).toBe(false);
    session.markDirty();
    expect(session.dirty).toBe(true);
    session.clearDirty();
    expect(session.dirty).toBe(false);
  });

  it("updateCurrentLayout persists the toJSON snapshot and clears dirty", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const workspace = useWorkspaceStore();
    const layoutStore = useLayoutStore();
    await workspace.loadAll();
    await layoutStore.loadForWorkspace(workspace.currentWorkspaceId!);

    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    session.markDirty();
    const updated = await session.updateCurrentLayout();
    const persisted = updated.dockviewState as {
      grid: { fake: boolean };
      panels: Record<string, unknown>;
    };
    expect(persisted.grid).toEqual({ fake: true });
    expect(Object.keys(persisted.panels).sort()).toEqual([p1.id, p2.id].sort());
    expect(session.dirty).toBe(false);
  });

  it("discardChanges re-runs loadLayout against the persisted state", async () => {
    const { layout } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    session.markDirty();

    await session.discardChanges();
    expect(session.dirty).toBe(false);
    // clear should have been called once for the initial load and once for discard
    expect(api.clear).toHaveBeenCalledTimes(2);
  });

  it("saveCurrentAsNewLayout creates a new layout with cloned panel-states", async () => {
    const { ws, layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const workspace = useWorkspaceStore();
    const layoutStore = useLayoutStore();
    const panelStateStore = usePanelStateStore();
    await workspace.loadAll();
    await layoutStore.loadForWorkspace(workspace.currentWorkspaceId!);

    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const created = await session.saveCurrentAsNewLayout({
      name: "Saved",
      setAsWorkspaceDefault: true,
    });

    expect(created.id).not.toBe(layout.id);
    expect(created.workspaceId).toBe(ws.id);
    // New layout has its own panel-state records (different ids)
    const newPanels = await panelStateRepo.listByLayout(created.id);
    expect(newPanels).toHaveLength(2);
    expect(newPanels.map((p) => p.id).sort()).not.toEqual([p1.id, p2.id].sort());
    expect(newPanels.map((p) => p.panelType).sort()).toEqual(["cesium", "maplibre"]);

    // Workspace default was repointed
    const workspaceAfter = await workspaceRepo.getById(ws.id);
    expect(workspaceAfter?.defaultLayoutId).toBe(created.id);

    // Current layout pointer moved to the new one
    expect(layoutStore.currentLayoutId).toBe(created.id);
    expect(session.loadedLayoutId).toBe(created.id);

    // Stores have refreshed; panelStateStore now points at the new layout
    expect(panelStateStore.loadedLayoutId).toBe(created.id);
  });

  it("switchWorkspace updates pointers and loads the other workspace's default layout", async () => {
    const { ws: wsA, layout: layoutA } = await seedWorkspace();
    const wsB = await workspaceRepo.create({ name: "WS-B" });
    const layoutB = await layoutRepo.create({ workspaceId: wsB.id, name: "L-B" });
    await workspaceRepo.update(wsB.id, { defaultLayoutId: layoutB.id });

    const session = useSessionStore();
    const workspace = useWorkspaceStore();
    const layoutStore = useLayoutStore();
    await workspace.loadAll();
    await layoutStore.loadForWorkspace(workspace.currentWorkspaceId!);

    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layoutA.id);
    expect(session.loadedLayoutId).toBe(layoutA.id);
    expect(workspace.currentWorkspaceId).toBe(wsA.id);

    await session.switchWorkspace(wsB.id);
    expect(workspace.currentWorkspaceId).toBe(wsB.id);
    expect(layoutStore.currentLayoutId).toBe(layoutB.id);
    expect(session.loadedLayoutId).toBe(layoutB.id);
  });
});
