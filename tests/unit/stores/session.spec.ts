import type { DockviewApi } from "dockview-vue";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetNotifyForTests, __setNotifyHandleForTests } from "@/composables/useNotify";
import { __unregisterBuiltinPanelsForTests, registerBuiltinPanels } from "@/modules/panels/builtin";
import { floatWasHeaderless } from "@/modules/panels/float";
import { isHeaderless } from "@/modules/panels/headerless";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import { useLayoutStore } from "@/stores/layout";
import { useMinimizedStore } from "@/stores/minimized";
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
  /** Active-tab id; `activePanel` resolves it (falls back to the first panel). */
  activeId?: string;
  readonly activePanel: FakePanel | undefined;
  /** Off-grid override for the maximize gate; defaults to "grid".
   *  Mirrors the real DockviewGroupLocation union (grid|floating|popout|edge). */
  locationType: "grid" | "floating" | "popout" | "edge";
  /** Group-level api — only `location` + `moveTo` are modeled (float / dockBack). */
  api: {
    location: { type: "grid" | "floating" | "popout" | "edge" };
    moveTo: (opts: { group?: FakeGroup; position?: unknown }) => void;
  };
  /** Minimal DOM stub — float opacity writes (`setProperty`, a spy) + reads back
   *  (`getPropertyValue`) the `--cv-float-alpha` var; `getBoundingClientRect` is the
   *  pop-out position source. */
  element: {
    style: { setProperty: ReturnType<typeof vi.fn>; getPropertyValue: (k: string) => string };
    getBoundingClientRect: () => { left: number; top: number; width: number; height: number };
  };
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
    setActive: () => void;
  };
}

/** Box matching dockview's AnchoredBox (width/height + one corner anchor). */
type FakeBox = {
  top?: number;
  left?: number;
  bottom?: number;
  right?: number;
  width: number;
  height: number;
};

/** Models a dockview internal floating-group handle (group + overlay + position),
 *  the surface `session.toggleFloatMaximize` reaches via `api.component.floatingGroups`. */
interface FakeFloatingGroup {
  group: FakeGroup;
  box: FakeBox;
  overlay: { toJSON: () => FakeBox };
  position: (b: Partial<FakeBox>) => void;
}

interface FakeDockviewApi {
  panels: FakePanel[];
  groups: FakeGroup[];
  width: number;
  height: number;
  /** Internal DockviewComponent surface — Phase 4b reaches `floatingGroups` here. */
  component: { floatingGroups: FakeFloatingGroup[] };
  clear: ReturnType<typeof vi.fn>;
  addGroup: () => FakeGroup;
  addPanel: ReturnType<typeof vi.fn>;
  addFloatingGroup: ReturnType<typeof vi.fn>;
  addPopoutGroup: ReturnType<typeof vi.fn>;
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

/** A DOM `style` stub that records `setProperty` (a spy, so existing assertions on
 *  `.mock.calls` keep working) AND serves the value back via `getPropertyValue` —
 *  needed by `syncActiveFloatAlpha`, which reads the applied `--cv-float-alpha`. */
function makeStyleStub(): {
  setProperty: ReturnType<typeof vi.fn>;
  getPropertyValue: (k: string) => string;
} {
  const props = new Map<string, string>();
  const setProperty = vi.fn((k: string, v: string) => {
    props.set(k, String(v));
  });
  return { setProperty, getPropertyValue: (k) => props.get(k) ?? "" };
}

function makeFakeApi(): DockviewApi {
  const panels: FakePanel[] = [];
  const groups: FakeGroup[] = [];
  const floatingGroups: FakeFloatingGroup[] = [];
  let groupSeq = 0;

  /** Drop the floating-group handle for a group that has been removed. */
  function dropFloating(group: FakeGroup): void {
    const i = floatingGroups.findIndex((f) => f.group === group);
    if (i >= 0) floatingGroups.splice(i, 1);
  }

  function makeGroup(): FakeGroup {
    const group: FakeGroup = {
      id: `g${++groupSeq}`,
      header: { hidden: false },
      panels: [],
      maximized: false,
      activeId: undefined,
      get activePanel() {
        return group.panels.find((p) => p.id === group.activeId) ?? group.panels[0];
      },
      locationType: "grid",
      element: {
        style: makeStyleStub(),
        getBoundingClientRect: () => ({ left: 100, top: 50, width: 600, height: 400 }),
      },
      api: {
        // Self-reference is SAFE: bodies run only when invoked later.
        get location() {
          return { type: group.locationType };
        },
        // Mirror dockviewGroupPanelApi.moveTo: with no target group, create a new
        // grid group and move THIS group's panels into it (the dockBack path).
        moveTo: (opts) => {
          const target = opts.group ?? makeGroup();
          for (const p of [...group.panels]) {
            detach(p);
            p.api.group = target;
            target.panels.push(p);
          }
        },
      },
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
      dropFloating(from);
    }
  }

  function addPanelImpl(p: {
    id: string;
    component: string;
    title?: string;
    position?: { referenceGroup?: FakeGroup; direction?: string; index?: number };
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
          // Honor `index` (dockview re-inserts at that tab slot); clamp, else append.
          const at =
            typeof opts.index === "number"
              ? Math.max(0, Math.min(opts.index, target.panels.length))
              : target.panels.length;
          target.panels.splice(at, 0, panel);
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
        setActive: () => {
          panel.api.group.activeId = panel.id;
        },
      },
    };
    // Honor `position.index` for a within-add (dockview inserts at that tab slot);
    // clamp, else append. A fresh neighbor group is empty so this is just a push.
    const at =
      within && typeof p.position?.index === "number"
        ? Math.max(0, Math.min(p.position.index, group.panels.length))
        : group.panels.length;
    group.panels.splice(at, 0, panel);
    panels.push(panel);
    return panel;
  }

  const stub: FakeDockviewApi = {
    panels,
    groups,
    width: 1000,
    height: 800,
    component: { floatingGroups },
    clear: vi.fn(() => {
      panels.length = 0;
      groups.length = 0;
      groupSeq = 0;
    }),
    addGroup: () => makeGroup(),
    addPanel: vi.fn(addPanelImpl),
    addFloatingGroup: vi.fn((item: FakePanel | FakeGroup) => {
      // dockview accepts a PANEL (floatPanel — move the single panel into a NEW
      // floating group) OR a GROUP (restoreMinimized — float the existing group in
      // place, keeping all its tabs). A group has a `panels` array; a panel doesn't.
      const fg: FakeGroup = Array.isArray((item as FakeGroup).panels)
        ? (item as FakeGroup)
        : (() => {
            const panel = item as FakePanel;
            // If the panel was the only one in its grid group, detach drops it.
            detach(panel);
            const g = makeGroup();
            panel.api.group = g;
            g.panels.push(panel);
            return g;
          })();
      fg.locationType = "floating";
      // Register the internal floating-group handle (overlay + position) that
      // session.toggleFloatMaximize reaches via api.component.floatingGroups.
      const handle: FakeFloatingGroup = {
        group: fg,
        box: { top: 120, left: 120, width: 520, height: 360 },
        overlay: { toJSON: () => ({ ...handle.box }) },
        position: (b) => {
          // Mirror dockview's Overlay re-anchoring: setting a corner clears its
          // opposite (a {top} reposition drops a prior {bottom}, etc.), so toJSON
          // reflects exactly one vertical + one horizontal anchor — letting tests
          // exercise the realistic bottom/right-anchored (user-dragged) case.
          const next: FakeBox = { ...handle.box, ...b };
          if (b.top !== undefined) delete next.bottom;
          if (b.bottom !== undefined) delete next.top;
          if (b.left !== undefined) delete next.right;
          if (b.right !== undefined) delete next.left;
          handle.box = next;
        },
      };
      floatingGroups.push(handle);
    }),
    // Pop-out (Phase 6a). Returns a configurable success flag; the real call opens
    // a window from a user gesture (untestable in jsdom), so we only model the
    // resolve. Defaults to opened=true; the blocked path uses `mockResolvedValueOnce`.
    addPopoutGroup: vi.fn(() => Promise.resolve(true)),
    removePanel: vi.fn((panel: FakePanel) => {
      const i = panels.indexOf(panel);
      if (i >= 0) panels.splice(i, 1);
      const g = panel.api.group;
      g.panels = g.panels.filter((p) => p !== panel);
      if (g.panels.length === 0) {
        const gi = groups.indexOf(g);
        if (gi >= 0) groups.splice(gi, 1);
        dropFloating(g);
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

/**
 * Install a recording notify handle and return the array its `add` calls push
 * toast summaries into. The session store fires save toasts via `useNotify`
 * (the module singleton), so a fake handle lets the save tests assert the
 * "Layout saved" feedback without a DOM. Torn down via `__resetNotifyForTests`.
 */
function recordToastSummaries(): string[] {
  const summaries: string[] = [];
  __setNotifyHandleForTests({
    add: (m) => summaries.push(m.summary),
    remove: () => {},
    removeGroup: () => {},
    removeAllGroups: () => {},
  });
  return summaries;
}

describe("useSessionStore", () => {
  beforeEach(async () => {
    await resetForStoreTest();
    __unbindDockviewForTests();
    __unregisterBuiltinPanelsForTests();
    registerBuiltinPanels();
  });

  afterEach(() => __resetNotifyForTests());

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
    const toasts = recordToastSummaries();
    const updated = await session.updateCurrentLayout();
    const persisted = updated.dockviewState as {
      grid: { fake: boolean };
      panels: Record<string, unknown>;
    };
    expect(persisted.grid).toEqual({ fake: true });
    expect(Object.keys(persisted.panels).sort()).toEqual([p1.id, p2.id].sort());
    expect(session.dirty).toBe(false);
    expect(toasts).toContain("Layout saved");
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

    const toasts = recordToastSummaries();
    const created = await session.saveCurrentAsNewLayout({
      name: "Saved",
      setAsWorkspaceDefault: true,
    });
    expect(toasts).toContain("Layout saved");

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
      getPanel: (
        id: string,
      ) =>
        | { api: { group: { panels: { id: string }[] }; moveTo: (o: { group?: unknown }) => void } }
        | undefined;
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
      getPanel: (
        id: string,
      ) =>
        | { api: { group: { panels: { id: string }[] }; moveTo: (o: { group?: unknown }) => void } }
        | undefined;
    };
    const targetGroup = fake.getPanel(p2.id)!.api.group;
    fake.getPanel(p1.id)!.api.moveTo({ group: targetGroup as never });

    await session.closeOthersInGroup(p2.id);
    expect((api as unknown as DockviewApi).panels.map((p) => p.id)).toEqual([p2.id]);
  });

  it("closeAllInGroup closes every panel in the group when panels exist elsewhere", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (id: string) => { api: { group: { panels: { id: string }[] } } } | undefined;
    };
    // p1 stays alone in its group; add a third tab into p2's group so the
    // target group holds two panels (p2 + p3) and the layout holds three.
    const targetGroup = fake.getPanel(p2.id)!.api.group;
    const p3 = await panelStateRepo.create({ layoutId: layout.id, panelType: "maplibre" });
    (api as unknown as DockviewApi).addPanel({
      id: p3.id,
      component: "maplibre",
      title: "third",
      position: { referenceGroup: targetGroup as never, direction: "within" },
    });

    const closed = await session.closeAllInGroup(p2.id);
    expect(closed).toBe(true);
    // Both members of the target group are gone; the unrelated p1 survives.
    expect((api as unknown as DockviewApi).getPanel(p2.id)).toBeUndefined();
    expect((api as unknown as DockviewApi).getPanel(p3.id)).toBeUndefined();
    expect((api as unknown as DockviewApi).panels.map((p) => p.id)).toEqual([p1.id]);
    expect(session.dirty).toBe(true);
  });

  it("closeAllInGroup never empties the workspace (leaves the last pane via the guard)", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) =>
        | { api: { group: { panels: { id: string }[] }; moveTo: (o: { group?: unknown }) => void } }
        | undefined;
    };
    // Force both panels into one group so that group IS the whole layout.
    const targetGroup = fake.getPanel(p2.id)!.api.group;
    fake.getPanel(p1.id)!.api.moveTo({ group: targetGroup as never });

    const closed = await session.closeAllInGroup(p2.id);
    expect(closed).toBe(true);
    // Exactly one pane remains — the guard stopped the last removal — and because
    // the invoked pane is iterated last, the survivor is deterministically p2 (the
    // pane Close All was invoked from), not an arbitrary group member.
    expect((api as unknown as DockviewApi).panels.map((p) => p.id)).toEqual([p2.id]);
  });

  it("closeAllInGroup is a no-op (returns false) on a single-panel layout", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    // Reduce the layout to a single pane, then Close All on it must no-op.
    await session.removePanelGuarded(p2.id);
    expect((api as unknown as DockviewApi).panels.map((p) => p.id)).toEqual([p1.id]);
    session.clearDirty();

    const closed = await session.closeAllInGroup(p1.id);
    expect(closed).toBe(false);
    expect((api as unknown as DockviewApi).panels.map((p) => p.id)).toEqual([p1.id]);
    expect(session.dirty).toBe(false);
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

  it("floatPanel floats a grid pane: location becomes floating, header shown, dirty", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) =>
        | { api: { location: { type: string }; group: { header: { hidden: boolean } } } }
        | undefined;
    };

    expect(fake.getPanel(p2.id)!.api.location.type).toBe("grid");
    const floated = await session.floatPanel(p2.id);
    expect(floated).toBe(true);
    expect(fake.getPanel(p2.id)!.api.location.type).toBe("floating");
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(false);
    expect(session.dirty).toBe(true);
  });

  it("floatPanel is a no-op (false) when the pane is not grid-located", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p2.id); // now floating
    expect(await session.floatPanel(p2.id)).toBe(false);
  });

  it("dockBack is a no-op (false) when the pane is not floating", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    expect(await session.dockBack(p2.id)).toBe(false); // p2 is grid-docked
  });

  it("a clean pane floats with its header shown, and dock-back restores clean status", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    const pss = usePanelStateStore();
    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) =>
        | { api: { location: { type: string }; group: { header: { hidden: boolean } } } }
        | undefined;
    };

    // Make p2 clean (header-less).
    await session.toggleHeaderless(p2.id);
    expect(isHeaderless(pss.getState(p2.id)?.state)).toBe(true);

    // Float it: a float always shows a header; the clean flag is stripped but
    // remembered via floatPrevHeaderless.
    await session.floatPanel(p2.id);
    expect(fake.getPanel(p2.id)!.api.location.type).toBe("floating");
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(false);
    expect(isHeaderless(pss.getState(p2.id)?.state)).toBe(false);
    expect(floatWasHeaderless(pss.getState(p2.id)?.state)).toBe(true);

    // Dock back: clean status is restored and the remember-flag is cleared.
    await session.dockBack(p2.id);
    expect(fake.getPanel(p2.id)!.api.location.type).toBe("grid");
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(true);
    expect(isHeaderless(pss.getState(p2.id)?.state)).toBe(true);
    expect(floatWasHeaderless(pss.getState(p2.id)?.state)).toBe(false);
  });

  it("a tabbed (non-clean) pane floats and dock-back leaves it headered", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    const pss = usePanelStateStore();
    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) =>
        | { api: { location: { type: string }; group: { header: { hidden: boolean } } } }
        | undefined;
    };

    await session.floatPanel(p2.id);
    expect(floatWasHeaderless(pss.getState(p2.id)?.state)).toBe(false); // was not clean
    await session.dockBack(p2.id);
    expect(fake.getPanel(p2.id)!.api.location.type).toBe("grid");
    expect(fake.getPanel(p2.id)!.api.group.header.hidden).toBe(false); // stays headered
    expect(isHeaderless(pss.getState(p2.id)?.state)).toBe(false);
  });

  it("popOutGroup returns false for an unknown panel and never opens a window", async () => {
    const { layout } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    expect(await session.popOutGroup("does-not-exist" as never)).toBe(false);
    expect(
      (api as unknown as { addPopoutGroup: ReturnType<typeof vi.fn> }).addPopoutGroup,
    ).not.toHaveBeenCalled();
  });

  it("popOutGroup pops the WHOLE group with a VIEWPORT-relative position + popout url, and marks dirty", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    session.clearDirty();

    expect(await session.popOutGroup(p2.id)).toBe(true);
    expect(session.dirty).toBe(true);
    const call = (api as unknown as { addPopoutGroup: ReturnType<typeof vi.fn> }).addPopoutGroup
      .mock.calls[0]!;
    // The relocated item is the GROUP (it carries a `panels` array; a panel doesn't).
    expect(Array.isArray((call[0] as { panels?: unknown }).panels)).toBe(true);
    const opts = call[1] as { position: Record<string, number>; popoutUrl: string };
    expect(opts.popoutUrl).toBe("/popout.html");
    // Group rect is {left:100, top:50, w:600, h:400}; the position is viewport-relative
    // (NO `window.screenX/Y` double-add — dockview adds the screen offset itself).
    expect(opts.position).toEqual({ left: 140, top: 130, width: 600, height: 400 });
  });

  it("popOutPanel pops only the single panel (relocates the PANEL, not its group), and marks dirty", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    session.clearDirty();

    expect(await session.popOutPanel(p2.id)).toBe(true);
    expect(session.dirty).toBe(true);
    const call = (api as unknown as { addPopoutGroup: ReturnType<typeof vi.fn> }).addPopoutGroup
      .mock.calls[0]!;
    // The relocated item is the PANEL itself (id matches; no `panels` array), so the
    // rest of its group stays docked — the per-tab counterpart of popOutGroup.
    expect((call[0] as { id?: string }).id).toBe(p2.id);
    expect((call[0] as { panels?: unknown }).panels).toBeUndefined();
    // Same viewport-relative position (seeded from the source group's rect).
    const opts = call[1] as { position: Record<string, number>; popoutUrl: string };
    expect(opts.position).toEqual({ left: 140, top: 130, width: 600, height: 400 });
  });

  it("popOutPanel returns false for an unknown panel and never opens a window", async () => {
    const { layout } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    expect(await session.popOutPanel("does-not-exist" as never)).toBe(false);
    expect(
      (api as unknown as { addPopoutGroup: ReturnType<typeof vi.fn> }).addPopoutGroup,
    ).not.toHaveBeenCalled();
  });

  it("popOutGroup returns false and stays clean when the browser blocks the window", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    session.clearDirty();
    (
      api as unknown as { addPopoutGroup: ReturnType<typeof vi.fn> }
    ).addPopoutGroup.mockResolvedValueOnce(false);

    expect(await session.popOutGroup(p2.id)).toBe(false);
    expect(session.dirty).toBe(false);
  });

  /** Cross-window relocation (Phase 7). loadLayout places p1 (cesium) and p2
   *  (maplibre) in separate grid groups, so they make a clean source/target pair. */
  type GroupPeek = { getPanel: (id: string) => { api: { group: { id: string } } } | undefined };
  const groupIdOf = (api: unknown, id: string): string | undefined =>
    (api as GroupPeek).getPanel(id)?.api.group.id;

  it("sendPanelToWindow moves the panel into the target group by id and marks dirty", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    session.clearDirty();

    const targetGroupId = groupIdOf(api, p2.id)!;
    expect(groupIdOf(api, p1.id)).not.toBe(targetGroupId); // start apart

    expect(session.sendPanelToWindow(p1.id, targetGroupId)).toBe(true);
    expect(groupIdOf(api, p1.id)).toBe(targetGroupId); // p1 now lives in p2's group
    expect(session.dirty).toBe(true);
  });

  it("sendPanelToWindow(panelId, null) sends to a different grid group (main window)", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    session.clearDirty();

    const otherGrid = groupIdOf(api, p2.id)!;
    expect(session.sendPanelToWindow(p1.id, null)).toBe(true);
    expect(groupIdOf(api, p1.id)).toBe(otherGrid); // landed in the existing grid group
    expect(session.dirty).toBe(true);
  });

  it("sendPanelToWindow returns false for an unknown panel or a stale target id", async () => {
    const { layout, p1 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    session.clearDirty();

    expect(session.sendPanelToWindow("nope" as never, null)).toBe(false);
    expect(session.sendPanelToWindow(p1.id, "ghost-group")).toBe(false); // no such group
    // No-op target (its own group) is refused too.
    expect(session.sendPanelToWindow(p1.id, groupIdOf(api, p1.id)!)).toBe(false);
    expect(session.dirty).toBe(false);
  });

  /** Cast helper: a panel's group (header/panels/locationType) + location + moveTo. */
  type DockFake = {
    getPanel: (id: string) =>
      | {
          api: {
            group: FakeGroup;
            location: { type: string };
            moveTo: (o: { group?: unknown }) => void;
          };
        }
      | undefined;
  };

  it("dockBack returns a floated tab to its ORIGINAL headered group when the origin survives", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    const pss = usePanelStateStore();
    const fake = api as unknown as DockFake;

    // A HEADERED 2-tab group {p1, p2}. (cesium auto-cleans as the mainPane; un-clean it.)
    await session.toggleHeaderless(p1.id);
    const originGroup = fake.getPanel(p1.id)!.api.group;
    expect(originGroup.header.hidden).toBe(false);
    fake.getPanel(p2.id)!.api.moveTo({ group: originGroup as never });

    await session.floatPanel(p2.id);
    expect(fake.getPanel(p2.id)!.api.group.locationType).toBe("floating");

    await session.dockBack(p2.id);
    // p2 re-joins p1's ORIGINAL group (same object) as a normal tab.
    const g1 = fake.getPanel(p1.id)!.api.group;
    const g2 = fake.getPanel(p2.id)!.api.group;
    expect(g2).toBe(g1);
    expect(g1.panels.map((p) => p.id).sort()).toEqual([p1.id, p2.id].sort());
    expect(isHeaderless(pss.getState(p2.id)?.state)).toBe(false); // a tab in a headered group
  });

  it("dockBack restores the floated tab to its ORIGINAL tab position, not the end", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    const fake = api as unknown as DockFake;

    // Headered group ordered [p1, p2, p3]; float the MIDDLE tab (p2, index 1).
    await session.toggleHeaderless(p1.id);
    const originGroup = fake.getPanel(p1.id)!.api.group;
    fake.getPanel(p2.id)!.api.moveTo({ group: originGroup as never }); // [p1, p2]
    const p3 = await panelStateRepo.create({ layoutId: layout.id, panelType: "maplibre" });
    (api as unknown as DockviewApi).addPanel({
      id: p3.id,
      component: "maplibre",
      title: "third",
      position: { referenceGroup: originGroup as never, direction: "within" },
    }); // [p1, p2, p3]
    expect(originGroup.panels.map((p) => p.id)).toEqual([p1.id, p2.id, p3.id]);

    await session.floatPanel(p2.id); // p2 was at index 1; group is now [p1, p3]
    await session.dockBack(p2.id);
    // p2 re-docks at index 1 (between p1 and p3), NOT appended to the end.
    expect(fake.getPanel(p2.id)!.api.group.panels.map((p) => p.id)).toEqual([p1.id, p2.id, p3.id]);
  });

  it("dockBack does NOT re-join a CLEAN origin group (no illegal 2-tab clean group) — falls back", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    const fake = api as unknown as DockFake;

    await session.toggleHeaderless(p1.id); // headered {p1}
    const originGroup = fake.getPanel(p1.id)!.api.group;
    fake.getPanel(p2.id)!.api.moveTo({ group: originGroup as never }); // {p1, p2}
    await session.floatPanel(p2.id); // origin = p1; group back to {p1}
    await session.toggleHeaderless(p1.id); // p1 is now CLEAN (single pane)
    expect(fake.getPanel(p1.id)!.api.group.header.hidden).toBe(true);

    await session.dockBack(p2.id);
    // p2 must NOT join the clean origin; it docks to its OWN group, p1 stays single.
    expect(fake.getPanel(p2.id)!.api.group).not.toBe(fake.getPanel(p1.id)!.api.group);
    expect(fake.getPanel(p1.id)!.api.group.panels.map((p) => p.id)).toEqual([p1.id]);
    expect(fake.getPanel(p2.id)!.api.location.type).toBe("grid");
  });

  it("dockBack opens a fresh group when the floated pane was its group's sole member", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    const fake = api as unknown as DockFake;
    // p2 is alone → floating destroys its origin group; dockBack can't re-join it.
    await session.floatPanel(p2.id);
    await session.dockBack(p2.id);
    expect(fake.getPanel(p2.id)!.api.location.type).toBe("grid");
    expect(fake.getPanel(p2.id)!.api.group).not.toBe(fake.getPanel(p1.id)!.api.group);
  });

  it("dockBack opens a fresh group when the origin group-mate is no longer a grid pane", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    const fake = api as unknown as DockFake;

    await session.toggleHeaderless(p1.id); // headered origin
    const originGroup = fake.getPanel(p1.id)!.api.group;
    fake.getPanel(p2.id)!.api.moveTo({ group: originGroup as never });
    await session.floatPanel(p2.id); // captures origin = p1
    await session.floatPanel(p1.id); // p1 now floats too → not a grid origin

    await session.dockBack(p2.id);
    expect(fake.getPanel(p1.id)!.api.location.type).toBe("floating"); // p1 untouched
    expect(fake.getPanel(p2.id)!.api.location.type).toBe("grid");
    expect(fake.getPanel(p2.id)!.api.group.panels.map((p) => p.id)).toEqual([p2.id]); // own new group
  });

  it("multiple floats cascade their initial position so they do not stack", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p1.id);
    await session.floatPanel(p2.id);
    const calls = (api as unknown as { addFloatingGroup: { mock: { calls: unknown[][] } } })
      .addFloatingGroup.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![1]).toMatchObject({ x: 120, y: 120, width: 520, height: 360 });
    expect(calls[1]![1]).toMatchObject({ x: 148, y: 148 });
  });

  it("the cascade counter uses the live float count (resets on dock-back)", async () => {
    const { layout, p1 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p1.id); // 0 floats -> x 120
    await session.dockBack(p1.id); // none floating now
    await session.floatPanel(p1.id); // 0 floats again -> x 120, NOT 148
    const calls = (api as unknown as { addFloatingGroup: { mock: { calls: unknown[][] } } })
      .addFloatingGroup.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![1]).toMatchObject({ x: 120 });
    expect(calls[1]![1]).toMatchObject({ x: 120 });
  });

  it("setFloatAlpha sets the --cv-float-alpha var on the group, persists, and clamps", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p2.id);

    await session.setFloatAlpha(p2.id, 0.4);
    expect(session.getFloatAlpha(p2.id)).toBe(0.4);
    expect(session.dirty).toBe(true);
    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) =>
        | { api: { group: { element: { style: { setProperty: ReturnType<typeof vi.fn> } } } } }
        | undefined;
    };
    const calls = fake.getPanel(p2.id)!.api.group.element.style.setProperty.mock.calls;
    expect(calls.some((c) => c[0] === "--cv-float-alpha" && c[1] === "0.4")).toBe(true);

    // Clamps out-of-range input to [0, 1].
    await session.setFloatAlpha(p2.id, 1.5);
    expect(session.getFloatAlpha(p2.id)).toBe(1);
    await session.setFloatAlpha(p2.id, -0.2);
    expect(session.getFloatAlpha(p2.id)).toBe(0);
  });

  it("loadLayout re-applies a persisted float alpha (applyFloatAlphas) and stays clean", async () => {
    const { layout, p2 } = await seedWorkspace();
    await panelStateRepo.update(p2.id, { state: { floatAlpha: 0.5 } });
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) =>
        | { api: { group: { element: { style: { setProperty: ReturnType<typeof vi.fn> } } } } }
        | undefined;
    };
    const calls = fake.getPanel(p2.id)!.api.group.element.style.setProperty.mock.calls;
    expect(calls.some((c) => c[0] === "--cv-float-alpha" && c[1] === "0.5")).toBe(true);
    expect(session.dirty).toBe(false); // re-apply is restoring-guarded
  });

  it("re-floating a dimmed pane re-applies its opacity to the new group element", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p2.id);
    await session.setFloatAlpha(p2.id, 0.4);
    await session.dockBack(p2.id); // back to a grid group
    await session.floatPanel(p2.id); // re-float -> NEW floating group

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) =>
        | { api: { group: { element: { style: { setProperty: ReturnType<typeof vi.fn> } } } } }
        | undefined;
    };
    const calls = fake.getPanel(p2.id)!.api.group.element.style.setProperty.mock.calls;
    expect(calls.some((c) => c[0] === "--cv-float-alpha" && c[1] === "0.4")).toBe(true);
  });

  it("setFloatAlpha is group-wide — every tab of a multi-tab float persists the same alpha", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p2.id);

    // Drag p1 into p2's float → a 2-tab float sharing ONE group element.
    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { api: { group: FakeGroup; moveTo: (o: { group?: unknown }) => void } } | undefined;
    };
    fake.getPanel(p1.id)!.api.moveTo({ group: fake.getPanel(p2.id)!.api.group as never });

    await session.setFloatAlpha(p2.id, 0.4);
    // Both tabs read the same alpha — switching tabs no longer snaps back to 100%.
    expect(session.getFloatAlpha(p2.id)).toBe(0.4);
    expect(session.getFloatAlpha(p1.id)).toBe(0.4);
  });

  it("syncActiveFloatAlpha adopts the group's applied alpha onto a dragged-in tab", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p2.id);
    await session.setFloatAlpha(p2.id, 0.3); // group var = 0.3, p2 = 0.3

    // p1 (still default 1) is dragged into the dimmed float, keeping its own value.
    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { api: { group: FakeGroup; moveTo: (o: { group?: unknown }) => void } } | undefined;
    };
    fake.getPanel(p1.id)!.api.moveTo({ group: fake.getPanel(p2.id)!.api.group as never });
    expect(session.getFloatAlpha(p1.id)).toBe(1); // stale pre-sync

    session.clearDirty();
    await session.syncActiveFloatAlpha(p1.id);
    expect(session.getFloatAlpha(p1.id)).toBe(0.3); // adopted the group's glass
    expect(session.dirty).toBe(false); // reconciliation is dirty-neutral
  });

  it("syncActiveFloatAlpha is a no-op off a float and when already in sync", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    // Docked (grid) panel → not floating → no change, no throw.
    session.clearDirty();
    await session.syncActiveFloatAlpha(p2.id);
    expect(session.getFloatAlpha(p2.id)).toBe(1);
    expect(session.dirty).toBe(false);

    // Floated at the default (var unset → group alpha 1) and already in sync → no write.
    await session.floatPanel(p2.id);
    session.clearDirty();
    await session.syncActiveFloatAlpha(p2.id);
    expect(session.dirty).toBe(false);
  });

  it("syncActiveFloatAlpha keeps a lone float's dim (tear-off) rather than snapping to solid", async () => {
    const { layout, p2 } = await seedWorkspace();
    await panelStateRepo.update(p2.id, { state: { floatAlpha: 0.3 } });
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p2.id); // a single dimmed float

    // Simulate a fresh torn-off group whose shared var was never set.
    const fake = api as unknown as {
      getPanel: (id: string) =>
        | {
            api: {
              group: {
                element: {
                  style: {
                    setProperty: (k: string, v: string) => void;
                    getPropertyValue: (k: string) => string;
                  };
                };
              };
            };
          }
        | undefined;
    };
    const grp = fake.getPanel(p2.id)!.api.group;
    grp.element.style.setProperty("--cv-float-alpha", "");

    session.clearDirty();
    await session.syncActiveFloatAlpha(p2.id);
    // The lone float re-applies its OWN dim; the panel keeps 0.3 (not reset to solid).
    expect(grp.element.style.getPropertyValue("--cv-float-alpha")).toBe("0.3");
    expect(session.getFloatAlpha(p2.id)).toBe(0.3);
    expect(session.dirty).toBe(false); // dirty-neutral
  });

  it("toggleFloatMaximize fills a float to the dock size, then restores its prior box", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p2.id);

    const fg = (
      api as unknown as {
        component: {
          floatingGroups: Array<{
            overlay: {
              toJSON: () => { width: number; height: number; top?: number; left?: number };
            };
          }>;
        };
      }
    ).component.floatingGroups[0]!;

    // Maximize: overlay box fills the dock (api.width 1000 × api.height 800) at 0,0.
    session.clearDirty();
    expect(await session.toggleFloatMaximize(p2.id)).toBe(true);
    expect(session.getFloatMaximized(p2.id)).toBe(true);
    expect(fg.overlay.toJSON()).toMatchObject({ top: 0, left: 0, width: 1000, height: 800 });
    expect(session.dirty).toBe(true);

    // Restore: back to the pre-maximize box (the float's cascade default 520×360 @120,120).
    expect(await session.toggleFloatMaximize(p2.id)).toBe(true);
    expect(session.getFloatMaximized(p2.id)).toBe(false);
    expect(fg.overlay.toJSON()).toMatchObject({ top: 120, left: 120, width: 520, height: 360 });
  });

  it("toggleFloatMaximize restores an anchor-flipped (bottom/right) float to its dragged box", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p2.id);

    const fg = (
      api as unknown as {
        component: {
          floatingGroups: Array<{
            overlay: { toJSON: () => Record<string, number> };
            position: (b: Record<string, number>) => void;
          }>;
        };
      }
    ).component.floatingGroups[0]!;

    // Simulate the user dragging the float to the bottom-right (the overlay anchor
    // flips, dropping the top/left keys — like real dockview Overlay.toJSON).
    fg.position({ bottom: 40, right: 60, width: 300, height: 200 });
    expect("top" in fg.overlay.toJSON()).toBe(false);

    // Maximize fills (top/left), then Restore returns to the bottom/right anchor.
    await session.toggleFloatMaximize(p2.id);
    expect(fg.overlay.toJSON()).toMatchObject({ top: 0, left: 0, width: 1000, height: 800 });
    await session.toggleFloatMaximize(p2.id);
    expect(fg.overlay.toJSON()).toMatchObject({ bottom: 40, right: 60, width: 300, height: 200 });
    expect("top" in fg.overlay.toJSON()).toBe(false); // restored to bottom/right, no stale top
  });

  it("toggleFloatMaximize is a no-op (false) on a non-floating pane", async () => {
    const { layout, p1 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    expect(await session.toggleFloatMaximize(p1.id)).toBe(false); // p1 is docked (grid)
    expect(session.getFloatMaximized(p1.id)).toBe(false);
  });

  it("dockBack and floatPanel both clear maximize state (no stale flag survives)", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p2.id);
    await session.toggleFloatMaximize(p2.id);
    expect(session.getFloatMaximized(p2.id)).toBe(true);

    await session.dockBack(p2.id); // dock-back clears the maximize state
    expect(session.getFloatMaximized(p2.id)).toBe(false);

    await session.floatPanel(p2.id); // and a fresh float also starts un-maximized
    expect(session.getFloatMaximized(p2.id)).toBe(false);
  });

  it("minimizeGroup captures a grid group and removes it; restoreMinimized re-adds it", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const entry = session.minimizeGroup(p2.id);
    expect(entry).not.toBeNull();
    expect(entry!.location).toBe("grid");
    expect(entry!.panels.map((c) => c.id)).toEqual([p2.id]);
    // p2's group is gone; p1 survives.
    expect((api as unknown as DockviewApi).getPanel(p2.id)).toBeUndefined();
    expect((api as unknown as DockviewApi).getPanel(p1.id)).toBeDefined();

    expect(session.restoreMinimized(entry!)).toBe(true);
    expect((api as unknown as DockviewApi).getPanel(p2.id)).toBeDefined();
  });

  it("the minimized store round-trips a group: minimize -> entry -> restore -> back", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const minimized = useMinimizedStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    minimized.minimizeGroup(p2.id);
    expect(minimized.entries.length).toBe(1);
    expect((api as unknown as DockviewApi).getPanel(p2.id)).toBeUndefined();

    minimized.restore(minimized.entries[0]!.id);
    expect(minimized.entries.length).toBe(0);
    expect((api as unknown as DockviewApi).getPanel(p2.id)).toBeDefined();
  });

  it("minimizeGroup is ephemeral — does not mark the layout dirty", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    session.clearDirty();
    session.minimizeGroup(p2.id);
    expect(session.dirty).toBe(false);
  });

  it("minimizeGroup captures every panel of a multi-panel group and restoreMinimized re-adds all", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { api: { group: FakeGroup; moveTo: (o: { group?: unknown }) => void } } | undefined;
    };
    const targetGroup = fake.getPanel(p2.id)!.api.group;
    fake.getPanel(p1.id)!.api.moveTo({ group: targetGroup as never });
    const p3 = await panelStateRepo.create({ layoutId: layout.id, panelType: "maplibre" });
    (api as unknown as DockviewApi).addPanel({
      id: p3.id,
      component: "maplibre",
      title: "third",
      position: { referenceGroup: targetGroup as never, direction: "within" },
    });

    const entry = session.minimizeGroup(p2.id);
    expect(entry!.panels.map((c) => c.id).sort()).toEqual([p1.id, p2.id, p3.id].sort());
    expect((api as unknown as DockviewApi).panels.length).toBe(0); // whole layout minimized

    session.restoreMinimized(entry!);
    expect((api as unknown as DockviewApi).panels.map((p) => p.id).sort()).toEqual(
      [p1.id, p2.id, p3.id].sort(),
    );
  });

  it("minimizeGroup captures a floating group's box and restoreMinimized re-floats it", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p2.id);

    const entry = session.minimizeGroup(p2.id);
    expect(entry!.location).toBe("floating");
    expect(entry!.floatBox).toMatchObject({ width: 520, height: 360 });
    expect((api as unknown as DockviewApi).getPanel(p2.id)).toBeUndefined();

    session.restoreMinimized(entry!);
    const restored = (
      api as unknown as {
        getPanel: (id: string) => { api: { location: { type: string } } } | undefined;
      }
    ).getPanel(p2.id);
    expect(restored).toBeDefined();
    expect(restored!.api.location.type).toBe("floating");
  });

  it("minimizeGroup + restoreMinimized round-trips a MULTI-panel floating group", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p2.id);

    // Drag p1 into p2's floating group (a multi-tab float).
    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { api: { group: FakeGroup; moveTo: (o: { group?: unknown }) => void } } | undefined;
    };
    const floatGroup = fake.getPanel(p2.id)!.api.group;
    fake.getPanel(p1.id)!.api.moveTo({ group: floatGroup as never });
    expect(floatGroup.panels.length).toBe(2);

    const entry = session.minimizeGroup(p2.id);
    expect(entry!.location).toBe("floating");
    expect(entry!.panels.map((c) => c.id).sort()).toEqual([p1.id, p2.id].sort());

    session.restoreMinimized(entry!);
    // both panels restore into ONE floating group (not orphaned in a grid group).
    const g1 = fake.getPanel(p1.id)!.api.group;
    const g2 = fake.getPanel(p2.id)!.api.group;
    expect(g1).toBe(g2);
    expect(g1.locationType).toBe("floating");
    expect(g1.panels.length).toBe(2);
  });

  it("minimizePanel minimizes ONE tab; its group keeps the others; restore re-joins it", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    // Put p1 + p2 into ONE 2-tab grid group.
    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { api: { group: FakeGroup; moveTo: (o: { group?: unknown }) => void } } | undefined;
    };
    const group = fake.getPanel(p2.id)!.api.group;
    fake.getPanel(p1.id)!.api.moveTo({ group: group as never });
    expect(group.panels.length).toBe(2);

    const entry = session.minimizePanel(p2.id);
    expect(entry).not.toBeNull();
    expect(entry!.location).toBe("grid");
    expect(entry!.originAnchor.direction).toBe("within"); // re-joins, not a new neighbor
    expect(entry!.originAnchor.referencePanelId).toBe(p1.id);
    expect(entry!.panels.map((c) => c.id)).toEqual([p2.id]);
    // ONLY p2 removed; p1 stays in its group.
    expect((api as unknown as DockviewApi).getPanel(p2.id)).toBeUndefined();
    expect(group.panels.map((p) => p.id)).toEqual([p1.id]);

    session.restoreMinimized(entry!);
    const g1 = fake.getPanel(p1.id)!.api.group;
    const g2 = fake.getPanel(p2.id)!.api.group;
    expect(g2).toBe(g1); // p2 re-joined p1's SAME group
    expect(g1.panels.map((p) => p.id).sort()).toEqual([p1.id, p2.id].sort());
  });

  it("restoreMinimized returns a minimized tab to its ORIGINAL index, not the end", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { api: { group: FakeGroup; moveTo: (o: { group?: unknown }) => void } } | undefined;
    };
    // Order a 3-tab group [p2, p1, p3]; p1 is the MIDDLE tab (index 1).
    const group = fake.getPanel(p2.id)!.api.group;
    fake.getPanel(p1.id)!.api.moveTo({ group: group as never }); // [p2, p1]
    const p3 = await panelStateRepo.create({ layoutId: layout.id, panelType: "maplibre" });
    (api as unknown as DockviewApi).addPanel({
      id: p3.id,
      component: "maplibre",
      title: "third",
      position: { referenceGroup: group as never, direction: "within" },
    }); // [p2, p1, p3]
    expect(group.panels.map((p) => p.id)).toEqual([p2.id, p1.id, p3.id]);

    const entry = session.minimizePanel(p1.id);
    expect(entry!.originAnchor.index).toBe(1); // captured the middle index
    expect(group.panels.map((p) => p.id)).toEqual([p2.id, p3.id]);

    session.restoreMinimized(entry!);
    // p1 lands back at index 1 (between p2 and p3), NOT appended to the end.
    expect(fake.getPanel(p1.id)!.api.group.panels.map((p) => p.id)).toEqual([p2.id, p1.id, p3.id]);
  });

  it("minimizePanel on a sole-member group delegates to a whole-group minimize", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    // p2 is alone in its group → single-tab minimize collapses to a group minimize.
    const entry = session.minimizePanel(p2.id);
    expect(entry).not.toBeNull();
    expect(entry!.panels.map((c) => c.id)).toEqual([p2.id]);
    expect(entry!.originAnchor.direction).not.toBe("within"); // group path uses a side anchor
    expect((api as unknown as DockviewApi).getPanel(p2.id)).toBeUndefined();
    expect((api as unknown as DockviewApi).getPanel(p1.id)).toBeDefined();
  });

  it("minimizePanel from a multi-tab float re-joins the SAME float on restore", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    await session.floatPanel(p2.id);

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { api: { group: FakeGroup; moveTo: (o: { group?: unknown }) => void } } | undefined;
    };
    const floatGroup = fake.getPanel(p2.id)!.api.group;
    fake.getPanel(p1.id)!.api.moveTo({ group: floatGroup as never });
    expect(floatGroup.panels.length).toBe(2);
    expect(floatGroup.locationType).toBe("floating");

    const entry = session.minimizePanel(p2.id);
    expect(entry!.location).toBe("grid"); // re-joins via the within-anchor, NOT a re-float
    expect(entry!.originAnchor.direction).toBe("within");
    expect((api as unknown as DockviewApi).getPanel(p2.id)).toBeUndefined();
    expect(floatGroup.panels.map((p) => p.id)).toEqual([p1.id]); // float keeps p1

    session.restoreMinimized(entry!);
    const g1 = fake.getPanel(p1.id)!.api.group;
    const g2 = fake.getPanel(p2.id)!.api.group;
    expect(g2).toBe(g1);
    expect(g1.locationType).toBe("floating"); // p2 re-joined the float, not a grid group
    expect(g1.panels.length).toBe(2);
  });

  it("minimizePanel is ephemeral and the store round-trips a single tab", async () => {
    const { layout, p1, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const minimized = useMinimizedStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);

    const fake = api as unknown as {
      getPanel: (
        id: string,
      ) => { api: { group: FakeGroup; moveTo: (o: { group?: unknown }) => void } } | undefined;
    };
    fake.getPanel(p1.id)!.api.moveTo({ group: fake.getPanel(p2.id)!.api.group as never });

    session.clearDirty();
    minimized.minimizePanel(p2.id);
    expect(session.dirty).toBe(false); // ephemeral — no save nudge
    expect(minimized.entries.length).toBe(1);
    expect((api as unknown as DockviewApi).getPanel(p2.id)).toBeUndefined();

    minimized.restore(minimized.entries[0]!.id);
    expect(minimized.entries.length).toBe(0);
    expect((api as unknown as DockviewApi).getPanel(p2.id)).toBeDefined();
  });

  it("minimizeGroup returns null for an unknown panel", async () => {
    const { layout } = await seedWorkspace();
    const session = useSessionStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    expect(session.minimizeGroup("does-not-exist" as never)).toBeNull();
  });

  it("loadLayout clears the minimized tray (ephemeral)", async () => {
    const { layout, p2 } = await seedWorkspace();
    const session = useSessionStore();
    const minimized = useMinimizedStore();
    const api = makeFakeApi();
    session.bindDockview(api);
    await session.loadLayout(layout.id);
    minimized.minimizeGroup(p2.id);
    expect(minimized.entries.length).toBe(1);

    await session.loadLayout(layout.id); // reload empties the tray
    expect(minimized.entries.length).toBe(0);
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
