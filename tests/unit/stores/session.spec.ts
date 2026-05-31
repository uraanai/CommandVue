import type { DockviewApi } from "dockview-vue";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { __unregisterBuiltinPanelsForTests, registerBuiltinPanels } from "@/modules/panels/builtin";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import { useLayoutStore } from "@/stores/layout";
import { usePanelStateStore } from "@/stores/panelState";
import { __unbindDockviewForTests, useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";

import { resetForStoreTest } from "./helpers";

/**
 * Group-modeling DockviewApi test double for the clean-panes work. Models
 * the slice of dockview-core that Phase 1 session methods touch:
 *
 *  - `addPanel({ id, component, title, position? })` returns a panel whose
 *    `.api.group` is a group object with a MUTABLE `header.hidden` boolean.
 *    With no `position` the panel lands in its own fresh group. With
 *    `position.referenceGroup` it lands in that SAME group ONLY when
 *    `position.direction === 'within'`; for any other direction
 *    ('left'|'right'|'above'|'below') it lands in a NEW neighbor group.
 *    This mirrors real dockview's relative-docking semantics — the one
 *    distinction the rebuild rewrite and splitCleanNeighbor depend on.
 *  - `getPanel(id)` / `getGroup(id)` / `panels` / `groups` / `addGroup()`.
 *  - `panel.api.moveTo({ group?, position?, index?, skipSetActive? })` moves a
 *    panel to a target group (creating one when `group` is omitted).
 *  - `removePanel(panel)` detaches a panel and drops emptied groups.
 *
 * Everything not modeled is left off the stub; accessing it is a TypeError,
 * which surfaces accidental usage during a test. The fake deliberately does
 * NOT model group DOM (`element`/getBoundingClientRect) — the only rect logic
 * is the pure `cleanPaneControls`, unit-tested separately.
 */
interface FakeHeader {
  hidden: boolean;
}
interface FakeGroup {
  id: string;
  header: FakeHeader;
  panels: FakePanel[];
}
interface FakePanel {
  id: string;
  component: string;
  title?: string;
  api: {
    group: FakeGroup;
    moveTo: (opts: {
      group?: FakeGroup;
      position?: unknown;
      index?: number;
      skipSetActive?: boolean;
    }) => void;
  };
}

interface FakeDockviewApi {
  panels: FakePanel[];
  groups: FakeGroup[];
  clear: ReturnType<typeof vi.fn>;
  addGroup: () => FakeGroup;
  addPanel: ReturnType<typeof vi.fn>;
  removePanel: ReturnType<typeof vi.fn>;
  getPanel: (id: string) => FakePanel | undefined;
  getGroup: (id: string) => FakeGroup | undefined;
  toJSON: ReturnType<typeof vi.fn>;
  fromJSON: ReturnType<typeof vi.fn>;
  onDidLayoutChange: ReturnType<typeof vi.fn>;
}

function makeFakeApi(): DockviewApi {
  const panels: FakePanel[] = [];
  const groups: FakeGroup[] = [];
  let groupSeq = 0;

  function makeGroup(): FakeGroup {
    const group: FakeGroup = {
      id: `g${++groupSeq}`,
      header: { hidden: false },
      panels: [],
    };
    groups.push(group);
    return group;
  }

  function detach(panel: FakePanel): void {
    const from = panel.api.group;
    from.panels = from.panels.filter((p) => p !== panel);
    if (from.panels.length === 0) {
      const i = groups.indexOf(from);
      if (i >= 0) groups.splice(i, 1);
    }
  }

  function addPanelImpl(p: {
    id: string;
    component: string;
    title?: string;
    position?: { referenceGroup?: FakeGroup; direction?: string };
  }): FakePanel {
    const ref = p.position?.referenceGroup;
    const within = p.position?.direction === "within";
    // Honor relative-docking: 'within' joins the referenced group; any other
    // direction — or no direction — with a ref creates a NEW neighbor group; no
    // ref also creates a new group. (Our production code always passes 'right' or
    // 'within'.)
    const group = ref ? (within ? ref : makeGroup()) : makeGroup();
    const panel: FakePanel = {
      id: p.id,
      component: p.component,
      title: p.title,
      api: {
        group,
        moveTo: (opts) => {
          detach(panel);
          const target = opts.group ?? makeGroup();
          panel.api.group = target;
          target.panels.push(panel);
        },
      },
    };
    group.panels.push(panel);
    panels.push(panel);
    return panel;
  }

  const stub: FakeDockviewApi = {
    panels,
    groups,
    clear: vi.fn(() => {
      panels.length = 0;
      groups.length = 0;
      groupSeq = 0;
    }),
    addGroup: () => makeGroup(),
    addPanel: vi.fn(addPanelImpl),
    removePanel: vi.fn((panel: FakePanel) => {
      const i = panels.indexOf(panel);
      if (i >= 0) panels.splice(i, 1);
      const g = panel.api.group;
      g.panels = g.panels.filter((p) => p !== panel);
      if (g.panels.length === 0) {
        const gi = groups.indexOf(g);
        if (gi >= 0) groups.splice(gi, 1);
      }
    }),
    getPanel: (id: string) => panels.find((p) => p.id === id),
    getGroup: (id: string) => groups.find((g) => g.id === id),
    toJSON: vi.fn(() => ({
      grid: { fake: true },
      panels: Object.fromEntries(panels.map((p) => [p.id, {}])),
    })),
    // Intentional no-op on the no-`panels` branch so the existing
    // "loadLayout uses fromJSON when dockviewState is present" test (which
    // passes a blob without a `panels` key) keeps `addPanel` uncalled. The
    // round-trip test (Task 8) passes a blob WITH `panels` to exercise the
    // re-create branch.
    fromJSON: vi.fn((blob?: { panels?: Record<string, unknown> }) => {
      if (blob?.panels) {
        for (const id of Object.keys(blob.panels)) {
          addPanelImpl({ id, component: "cesium", title: "restored" });
        }
      }
    }),
    onDidLayoutChange: vi.fn(() => ({ dispose: () => undefined })),
  };
  return stub as unknown as DockviewApi;
}

async function seedWorkspace() {
  const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
  const layout = await layoutRepo.create({ workspaceId: ws.id, name: "L" });
  const p1 = await panelStateRepo.create({ layoutId: layout.id, panelType: "cesium" });
  const p2 = await panelStateRepo.create({ layoutId: layout.id, panelType: "maplibre" });
  // p1 (cesium) is created before p2 (maplibre), so p1.createdAt <= p2.createdAt and
  // listForLayout()'s createdAt sort keeps cesium first. (Task 5's mainPane reordering
  // guarantees cesium-first regardless.)
  await layoutRepo.update(layout.id, { panelIds: [p1.id, p2.id] });
  await workspaceRepo.update(ws.id, { defaultLayoutId: layout.id });
  return { ws, layout, p1, p2 };
}

describe("useSessionStore", () => {
  beforeEach(async () => {
    await resetForStoreTest();
    __unbindDockviewForTests();
    __unregisterBuiltinPanelsForTests();
    registerBuiltinPanels();
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

  it("markDirty no-ops while restoring is true", () => {
    const session = useSessionStore();
    expect(session.dirty).toBe(false);
    session.setRestoring(true);
    session.markDirty();
    expect(session.dirty).toBe(false);
    session.setRestoring(false);
    session.markDirty();
    expect(session.dirty).toBe(true);
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

  it("applyHeaderlessGroups hides the header for panels flagged headerless and is restoring-guarded", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    // Flag p1 (cesium) headerless in its persisted state.
    await panelStateRepo.update(p1.id, { state: { headerless: true } });

    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (id: string) => { api: { group: { header: { hidden: boolean } } } } | undefined;
    };
    expect(fake.getPanel(p1.id)!.api.group.header.hidden).toBe(true);
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(false);

    // Applying invariants must not leave the session dirty.
    expect(session.dirty).toBe(false);
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
