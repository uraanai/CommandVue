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
  maximized: boolean;
  /** Off-grid override for the maximize gate; defaults to "grid".
   *  Mirrors the real DockviewGroupLocation union (grid|floating|popout|edge). */
  locationType: "grid" | "floating" | "popout" | "edge";
}
interface FakePanel {
  id: string;
  component: string;
  title?: string;
  api: {
    group: FakeGroup;
    location: { type: "grid" | "floating" | "popout" | "edge" };
    moveTo: (opts: {
      group?: FakeGroup;
      position?: unknown;
      index?: number;
      skipSetActive?: boolean;
    }) => void;
    maximize: () => void;
    exitMaximized: () => void;
    isMaximized: () => boolean;
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
  maximizeGroup: ReturnType<typeof vi.fn>;
  exitMaximizedGroup: ReturnType<typeof vi.fn>;
  hasMaximizedGroup: ReturnType<typeof vi.fn>;
  onDidMaximizedGroupChange: ReturnType<typeof vi.fn>;
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
      maximized: false,
      locationType: "grid",
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
        // Self-reference is SAFE: the getter body runs only when invoked later,
        // never during construction - identical to the existing `moveTo` pattern.
        get location() {
          return { type: panel.api.group.locationType };
        },
        moveTo: (opts) => {
          detach(panel);
          const target = opts.group ?? makeGroup();
          panel.api.group = target;
          target.panels.push(panel);
        },
        // Maximize is group-scoped in dockview; model it as a single-maximized
        // invariant: maximizing this panel's group clears every other group's
        // flag (mirrors real dockview - at most one maximized group).
        maximize: () => {
          for (const g of groups) g.maximized = g === panel.api.group;
        },
        exitMaximized: () => {
          if (panel.api.group.maximized) panel.api.group.maximized = false;
        },
        isMaximized: () => panel.api.group.maximized,
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
    // Container-level maximize surface - modeled for fidelity but NOT exercised
    // by any session action (the production path uses panel.api.maximize()).
    // Real DockviewApi.maximizeGroup takes an IDockviewPanel, not a group.
    maximizeGroup: vi.fn((panel: FakePanel) => {
      for (const g of groups) g.maximized = g === panel.api.group;
    }),
    exitMaximizedGroup: vi.fn(() => {
      for (const g of groups) g.maximized = false;
    }),
    hasMaximizedGroup: vi.fn(() => groups.some((g) => g.maximized)),
    onDidMaximizedGroupChange: vi.fn(() => ({ dispose: () => undefined })),
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

  it("loadLayout rebuilds the dock from panel-states with the main pane added first", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    expect(api.clear).toHaveBeenCalled();
    expect(api.fromJSON).not.toHaveBeenCalled();
    // Both panels added (mainPane cesium first, others docked relative).
    const addedIds = vi.mocked(api.addPanel).mock.calls.map((c) => c[0]!.id);
    expect(addedIds[0]).toBe(p1.id); // cesium (mainPane) goes first
    expect(addedIds).toContain(p2.id);
    // The first sibling docked to the RIGHT of the main pane → its own group.
    const fake = api as unknown as {
      getPanel: (id: string) => { api: { group: unknown } } | undefined;
    };
    expect(fake.getPanel(p1.id)!.api.group).not.toBe(fake.getPanel(p2.id)!.api.group);
    expect(session.loadedLayoutId).toBe(layout.id);
    expect(session.dirty).toBe(false);
  });

  it("loadLayout reorders the mainPane-typed panel first even when seeded last", async () => {
    const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
    const layout = await layoutRepo.create({ workspaceId: ws.id, name: "L" });
    // maplibre created FIRST (lower createdAt), cesium (mainPane) SECOND.
    const maplibre = await panelStateRepo.create({ layoutId: layout.id, panelType: "maplibre" });
    const cesium = await panelStateRepo.create({ layoutId: layout.id, panelType: "cesium" });
    await layoutRepo.update(layout.id, { panelIds: [maplibre.id, cesium.id] });
    await workspaceRepo.update(ws.id, { defaultLayoutId: layout.id });

    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const addedIds = vi.mocked(api.addPanel).mock.calls.map((c) => c[0]!.id);
    // Only passes if mainPanelType() reordering ran (creation order would put maplibre first).
    expect(addedIds[0]).toBe(cesium.id);
  });

  it("loadLayout backfills cesium as clean when no panel-state is headerless", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    // Cesium (mainPane) promoted to clean even though nothing was flagged.
    const fake = api as unknown as {
      getPanel: (id: string) => { api: { group: { header: { hidden: boolean } } } } | undefined;
    };
    expect(fake.getPanel(p1.id)!.api.group.header.hidden).toBe(true);
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(false);

    // Backfill PERSISTED headerless so it survives the next fromJSON load.
    const persisted = await panelStateRepo.getById(p1.id);
    expect(persisted?.state).toEqual({ headerless: true });
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

  it("toggleHeaderless flips a single-panel group's header and persists the flag", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { api: { group: { header: { hidden: boolean }; panels: unknown[] } } } | undefined;
    };
    // p2 (maplibre) is tabbed after load.
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(false);

    await session.toggleHeaderless(p2.id);
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(true);
    const persisted = await panelStateRepo.getById(p2.id);
    expect(persisted?.state).toMatchObject({ headerless: true });
    expect(session.dirty).toBe(false);

    // Toggling again reverts and clears the flag.
    await session.toggleHeaderless(p2.id);
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(false);
    const reverted = await panelStateRepo.getById(p2.id);
    expect("headerless" in (reverted?.state ?? {})).toBe(false);
  });

  it("toggleHeaderless moves a panel out of a multi-panel group before hiding the header", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (id: string) =>
        | {
            api: {
              group: { id: string; header: { hidden: boolean }; panels: { id: string }[] };
              moveTo: (o: unknown) => void;
            };
          }
        | undefined;
    };
    // Force p1 and p2 into the SAME group to simulate a >1-panel group.
    const targetGroup = fake.getPanel(p2.id)!.api.group;
    fake.getPanel(p1.id)!.api.moveTo({ group: targetGroup });
    expect(fake.getPanel(p1.id)!.api.group.panels.length).toBeGreaterThan(1);

    await session.toggleHeaderless(p1.id);
    // p1 now lives alone in a clean group.
    expect(fake.getPanel(p1.id)!.api.group.panels.map((p) => p.id)).toEqual([p1.id]);
    expect(fake.getPanel(p1.id)!.api.group.header.hidden).toBe(true);
    // p2 untouched.
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(false);
  });

  it("removePanelGuarded removes a panel when more than one remains", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const removed = await session.removePanelGuarded(p2.id);
    expect(removed).toBe(true);
    expect((api as unknown as DockviewApi).panels.map((p) => p.id)).toEqual([p1.id]);
  });

  it("removePanelGuarded refuses to remove the last remaining panel", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    // Remove one so a single panel remains.
    await session.removePanelGuarded(p2.id);
    const remainingId = (api as unknown as DockviewApi).panels[0]!.id;

    const removed = await session.removePanelGuarded(remainingId);
    expect(removed).toBe(false);
    expect((api as unknown as DockviewApi).panels).toHaveLength(1);
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

  it("splitCleanNeighbor adds the chosen panel type as a new clean neighbor", async () => {
    const { layout, p1 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { component: string; api: { group: { header: { hidden: boolean } } } } | undefined;
    };
    const sourceGroup = fake.getPanel(p1.id)!.api.group;
    const before = (api as unknown as DockviewApi).panels.length;

    // p1 (cesium) is clean after load (backfill); split it, choosing maplibre.
    const newId = await session.splitCleanNeighbor(p1.id, "maplibre");
    expect(newId).toBeTruthy();
    expect((api as unknown as DockviewApi).panels.length).toBe(before + 1);

    const created = fake.getPanel(newId!)!;
    expect(created.component).toBe("maplibre");
    expect(created.api.group.header.hidden).toBe(true); // new pane is clean
    expect(created.api.group).not.toBe(sourceGroup); // different group
    expect(sourceGroup.header.hidden).toBe(true); // source (cesium) was clean and stays clean

    const persisted = await panelStateRepo.getById(newId!);
    expect(persisted?.panelType).toBe("maplibre");
    expect(persisted?.state).toEqual({ headerless: true });

    // Splitting is a real user edit — the session must be dirty so it's savable.
    expect(session.dirty).toBe(true);
  });

  it("closeOthersInGroup removes every other panel in the target's group, keeping the target", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (id: string) => { api: { group: { panels: { id: string }[] } } } | undefined;
    };
    // Force p1 and p2 into the SAME (tabbed) group, then add a third tab.
    const targetGroup = fake.getPanel(p2.id)!.api.group;
    fake.getPanel(p1.id)!.api.moveTo({ group: targetGroup as never });
    const p3 = await panelStateRepo.create({ layoutId: layout.id, panelType: "maplibre" });
    (api as unknown as DockviewApi).addPanel({
      id: p3.id,
      component: "maplibre",
      title: "third",
      position: { referenceGroup: targetGroup as never, direction: "within" },
    });
    expect(
      fake
        .getPanel(p2.id)!
        .api.group.panels.map((p) => p.id)
        .sort(),
    ).toEqual([p1.id, p2.id, p3.id].sort());

    const closed = await session.closeOthersInGroup(p2.id);
    expect(closed).toBe(true);
    // Only the target survives in that group; the layout still has it.
    expect(fake.getPanel(p2.id)!.api.group.panels.map((p) => p.id)).toEqual([p2.id]);
    expect((api as unknown as DockviewApi).getPanel(p1.id)).toBeUndefined();
    expect((api as unknown as DockviewApi).getPanel(p3.id)).toBeUndefined();
    expect(session.dirty).toBe(true);
  });

  it("closeOthersInGroup is a no-op (returns false) when the group has only the target", async () => {
    const { layout, p1 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    // p1 (cesium) is clean and alone in its group after load.
    const closed = await session.closeOthersInGroup(p1.id);
    expect(closed).toBe(false);
  });

  it("closeOthersInGroup never empties the workspace (respects the guard)", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (id: string) => { api: { group: { panels: { id: string }[] } } } | undefined;
    };
    const targetGroup = fake.getPanel(p2.id)!.api.group;
    fake.getPanel(p1.id)!.api.moveTo({ group: targetGroup as never });

    await session.closeOthersInGroup(p2.id);
    expect((api as unknown as DockviewApi).panels.map((p) => p.id)).toEqual([p2.id]);
  });

  it("toggleMaximize maximizes a grid group, then restores it on second call", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (id: string) => { api: { isMaximized: () => boolean } } | undefined;
    };
    expect(fake.getPanel(p2.id)!.api.isMaximized()).toBe(false);

    const max = await session.toggleMaximize(p2.id);
    expect(max).toBe(true);
    expect(fake.getPanel(p2.id)!.api.isMaximized()).toBe(true);

    const restored = await session.toggleMaximize(p2.id);
    expect(restored).toBe(true);
    expect(fake.getPanel(p2.id)!.api.isMaximized()).toBe(false);
  });

  it("toggleMaximize is a no-op (returns false) for an off-grid group", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { api: { group: { locationType: string }; isMaximized: () => boolean } } | undefined;
    };
    // Simulate a floating group (Phase 2 has no float UI yet, but the gate
    // must still hold).
    fake.getPanel(p2.id)!.api.group.locationType = "floating";

    const result = await session.toggleMaximize(p2.id);
    expect(result).toBe(false);
    expect(fake.getPanel(p2.id)!.api.isMaximized()).toBe(false);
  });

  it("toggleMaximize does not dirty the session (view-only state, not persisted)", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.toggleMaximize(p2.id);
    expect(session.dirty).toBe(false);
  });

  it("clean mode survives a toJSON -> fromJSON round-trip via persisted state", async () => {
    const { layout, p1 } = await seedWorkspace();
    // Persist a dockviewState (carrying the panel id) so loadLayout takes the
    // fromJSON branch and the fake re-creates p1; flag p1 headerless.
    await layoutRepo.update(layout.id, {
      dockviewState: { grid: { restored: true }, panels: { [p1.id]: {} } },
    });
    await panelStateRepo.update(p1.id, { state: { headerless: true } });

    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    expect(api.fromJSON).toHaveBeenCalledWith({
      grid: { restored: true },
      panels: { [p1.id]: {} },
    });

    const fake = api as unknown as {
      getPanel: (id: string) => { api: { group: { header: { hidden: boolean } } } } | undefined;
    };
    expect(fake.getPanel(p1.id)!.api.group.header.hidden).toBe(true);
    expect(session.dirty).toBe(false);
  });
});
