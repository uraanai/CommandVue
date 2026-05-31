import type { Layout, PanelState, PanelType, Ulid } from "@/types/workspace";
import type { DockviewApi, DockviewGroupPanel, IDockviewPanel } from "dockview-vue";

import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";

import { isHeaderless, withHeaderless } from "@/modules/panels/headerless";
import { MISSING_PANEL_TYPE } from "@/modules/panels/missing";
import { panelRegistry } from "@/modules/panels/registry";
import { UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";

import { useLayoutStore } from "./layout";
import { usePanelStateStore } from "./panelState";
import { useThemeStore } from "./theme";
import { useWorkspaceStore } from "./workspace";

/**
 * Live in-memory session state — the bridge between the persisted Layout
 * records (owned by the layout / panelState stores) and the running
 * Dockview instance.
 *
 * The DockviewApi reference is held in a module-scope `shallowRef` outside
 * the Pinia-serializable surface. CLAUDE.md's architectural rule 4 forbids
 * non-serializable values in stores; this satisfies the constraint while
 * letting actions reach the live API.
 *
 * Dirty tracking: every `onDidLayoutChange` from Dockview marks the
 * session dirty. The user resolves dirty state via Save Layout (Cmd/Ctrl+S),
 * Save Layout As… (Cmd/Ctrl+Shift+S), or Discard. Phase D wires these
 * paths into menu actions.
 */
const dockviewApi = shallowRef<DockviewApi | null>(null);

export const useSessionStore = defineStore("session", () => {
  const loadedLayoutId = ref<null | Ulid>(null);
  const dirty = ref(false);
  const restoring = ref(false);

  function getDockviewApi(): DockviewApi | null {
    return dockviewApi.value;
  }

  function bindDockview(api: DockviewApi): void {
    dockviewApi.value = api;
  }

  function unbindDockview(): void {
    dockviewApi.value = null;
  }

  function markDirty(): void {
    if (restoring.value) return;
    dirty.value = true;
  }

  function clearDirty(): void {
    dirty.value = false;
  }

  /**
   * Toggle the restoring guard. While true, `markDirty` is a no-op so that
   * invariant application (header-less re-apply, backfill) and clean-pane
   * toggles never false-dirty the session. The single mutation path for the
   * guard — every internal caller uses this, never `restoring.value = …`.
   */
  function setRestoring(value: boolean): void {
    restoring.value = value;
  }

  /**
   * Build the dock from a layout's persisted `dockviewState` if present,
   * else from its panel-state records (stacking them as tabs in a single
   * group). Phase G adds per-panel `serialize`/`restore` so `dockviewState`
   * fills in on first save.
   */
  async function loadLayout(layoutId: Ulid): Promise<void> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");

    const layout = await layoutRepo.getById(layoutId);
    if (!layout) throw new Error(`Layout not found: ${layoutId}`);

    const panelStateStore = usePanelStateStore();
    await panelStateStore.loadForLayout(layoutId);
    const panelStates = panelStateStore.listForLayout();

    api.clear();
    if (layout.dockviewState) {
      try {
        api.fromJSON(layout.dockviewState as Parameters<DockviewApi["fromJSON"]>[0]);
      } catch {
        rebuildFromPanelStates(api, panelStates);
      }
    } else {
      rebuildFromPanelStates(api, panelStates);
    }

    await backfillCleanMainPane();
    applyHeaderlessGroups(api);

    loadedLayoutId.value = layoutId;
    dirty.value = false;
  }

  /**
   * Re-apply clean (header-less) mode after a load. `header.hidden` is NOT
   * serialized by dockview's `toJSON()`, so for every panel whose persisted
   * `PanelState.state` is headerless we set its group's header hidden. Safe
   * no-op when nothing is flagged. Restoring-guarded so it never dirties.
   */
  function applyHeaderlessGroups(api: DockviewApi): void {
    setRestoring(true);
    try {
      const panelStateStore = usePanelStateStore();
      for (const ps of panelStateStore.listForLayout()) {
        if (!isHeaderless(ps.state)) continue;
        const panel = api.getPanel(ps.id);
        const group = panel?.api.group;
        if (group) group.header.hidden = true;
      }
    } finally {
      setRestoring(false);
    }
  }

  /**
   * Single idempotent backfill point for legacy/seeded layouts: if NO
   * panel-state is headerless and a `mainPane`-typed panel exists, persist
   * `headerless: true` on it (cache + repo in sync via the panelState store)
   * so it survives into the next `fromJSON` path. No-op once any panel is
   * clean. This is the ONLY backfill site — never in seed.ts.
   */
  async function backfillCleanMainPane(): Promise<void> {
    const panelStateStore = usePanelStateStore();
    const states = panelStateStore.listForLayout();
    if (states.some((ps) => isHeaderless(ps.state))) return;
    const mainType = panelRegistry.mainPanelType();
    if (!mainType) return;
    const target = states.find((ps) => ps.panelType === mainType);
    if (!target) return;
    await panelStateStore.updateState(target.id, {
      state: withHeaderless(target.state, true),
    });
  }

  /**
   * Persist the current dock arrangement to the loaded layout. Captures
   * Dockview's serialized JSON, the panel-id list (in dock order), and
   * leaves panel-state values untouched (Phase G handles per-panel state).
   */
  async function updateCurrentLayout(): Promise<Layout> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    if (!loadedLayoutId.value) throw new Error("No layout loaded");

    const dockviewState = api.toJSON();
    const panelIds = api.panels.map((p) => p.id);
    const updated = await layoutRepo.update(loadedLayoutId.value, {
      dockviewState,
      panelIds,
    });
    const layoutStore = useLayoutStore();
    const wsId = layoutStore.currentLayout?.workspaceId;
    if (wsId) await layoutStore.loadForWorkspace(wsId);
    dirty.value = false;
    return updated;
  }

  /**
   * Save the current dock as a new layout in the current workspace. The
   * source layout's panel-state records are duplicated under fresh ULIDs so
   * the new layout owns its panels.
   */
  async function saveCurrentAsNewLayout(input: {
    name: string;
    description?: string;
    setAsWorkspaceDefault?: boolean;
  }): Promise<Layout> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");

    const workspaceStore = useWorkspaceStore();
    const layoutStore = useLayoutStore();
    const panelStateStore = usePanelStateStore();
    const workspaceId = workspaceStore.currentWorkspaceId;
    if (!workspaceId) throw new Error("No workspace loaded");

    const dockviewState = api.toJSON();
    const panelIds = api.panels.map((p) => p.id);

    const idMap = new Map<Ulid, Ulid>();
    const newPanelStates: PanelState[] = [];
    for (const sourceId of panelIds) {
      const source = panelStateStore.getState(sourceId);
      if (!source) continue;
      const cloned = await panelStateRepo.create({
        layoutId: "__pending__", // overwritten below
        panelType: source.panelType,
        assignmentState: source.assignmentState,
        state: structuredClone(source.state),
        appliedPresetIds: [...source.appliedPresetIds],
      });
      idMap.set(sourceId, cloned.id);
      newPanelStates.push(cloned);
    }

    let rewrittenDockview: unknown = dockviewState;
    if (rewrittenDockview && typeof rewrittenDockview === "object") {
      let serialized = JSON.stringify(rewrittenDockview);
      for (const [oldId, newId] of idMap) serialized = serialized.split(oldId).join(newId);
      rewrittenDockview = JSON.parse(serialized);
    }
    const newPanelIds = panelIds.map((id) => idMap.get(id) ?? id);

    const newLayout = await layoutRepo.create({
      workspaceId,
      name: input.name,
      description: input.description,
      dockviewState: rewrittenDockview,
      panelIds: newPanelIds,
    });

    for (const ps of newPanelStates) {
      await panelStateRepo.update(ps.id, {
        // Re-point the panel-states to their real owning layout. The repo
        // doesn't support changing layoutId via the `Update*Input` shape,
        // so we replace the records via a delete-and-recreate dance below.
      });
    }
    // Rewrite layoutId on the cloned panel-states (the repo's update doesn't
    // expose layoutId, so we delete + re-create here under the new layout).
    for (const ps of newPanelStates) {
      await panelStateRepo.delete(ps.id);
      await panelStateRepo.create({
        id: ps.id,
        layoutId: newLayout.id,
        panelType: ps.panelType,
        assignmentState: ps.assignmentState,
        state: ps.state,
        appliedPresetIds: ps.appliedPresetIds,
      });
    }

    if (input.setAsWorkspaceDefault) {
      await layoutStore.setDefaultForWorkspace(workspaceId, newLayout.id);
    }

    await layoutStore.loadForWorkspace(workspaceId);
    await layoutStore.setCurrentLayout(newLayout.id);
    await loadLayout(newLayout.id);
    return newLayout;
  }

  /**
   * Flip a panel's group between clean (header-less) and tabbed. A clean pane
   * holds exactly one panel, so when the group has >1 panel the active panel
   * is first split into its own new group, THEN the header is hidden. The
   * `headerless` flag is persisted to `PanelState.state` so it survives loads.
   * Restoring-guarded — toggling never dirties the session.
   */
  async function toggleHeaderless(panelId: Ulid): Promise<void> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const panel = api.getPanel(panelId);
    if (!panel) return;

    setRestoring(true);
    try {
      let group = panel.api.group;
      const makingClean = !group.header.hidden;
      if (makingClean && group.panels.length > 1) {
        // A clean pane is single-panel — split this panel to its own group.
        panel.api.moveTo({ group: api.addGroup(), skipSetActive: true });
        group = panel.api.group;
      }
      group.header.hidden = makingClean;

      const panelStateStore = usePanelStateStore();
      const existing = panelStateStore.getState(panelId);
      await panelStateStore.updateState(panelId, {
        state: withHeaderless(existing?.state, makingClean),
      });
    } finally {
      setRestoring(false);
    }
  }

  /**
   * Remove a panel, but REFUSE (return false, no throw) if doing so would
   * leave the layout with zero panels — the empty-workspace guard (spec §12).
   * Returning a boolean lets the UI close control skip the last pane without
   * an uncaught error in the click handler. Restoring-guarded around the
   * structural mutation; marks dirty afterward so the user can persist it.
   */
  async function removePanelGuarded(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    if (api.panels.length <= 1) return false;
    const panel = api.getPanel(panelId);
    if (!panel) return false;

    setRestoring(true);
    try {
      api.removePanel(panel);
    } finally {
      setRestoring(false);
    }
    markDirty();
    return true;
  }

  /**
   * Close every OTHER panel in the right-clicked panel's group, keeping the
   * target. Iterates a stable snapshot of `group.panels` (removing while
   * iterating the live array skips entries). Honors the empty-workspace guard:
   * a removal that would drop the layout to zero panels is skipped. Returns
   * `false` when nothing was eligible (group held only the target). Restoring-
   * guarded around the structural mutations; marks dirty when it removed at
   * least one panel (a real user edit, matching removePanelGuarded).
   */
  async function closeOthersInGroup(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const target = api.getPanel(panelId);
    if (!target) return false;

    const others = target.api.group.panels.filter((p) => p.id !== panelId);
    if (others.length === 0) return false;

    let removedAny = false;
    setRestoring(true);
    try {
      for (const other of others) {
        if (api.panels.length <= 1) break; // empty-workspace guard
        const panel = api.getPanel(other.id);
        if (!panel) continue;
        api.removePanel(panel);
        removedAny = true;
      }
    } finally {
      setRestoring(false);
    }
    if (removedAny) markDirty();
    return removedAny;
  }

  /**
   * Maximize the right-clicked panel's group, or restore it if already
   * maximized. Maximize is view-only state - dockview does NOT serialize it
   * into toJSON, so this does NOT mark the session dirty (matching the
   * restoring-guarded invariant style). Gated to grid-located groups: floating,
   * pop-out, and edge groups have no maximize concept, so the action is a no-op
   * there (Phase 2 ships no float/pop-out UI yet, but the gate is coded now).
   * `panel.api.location` resolves to `panel.api.group.api.location` in
   * dockview-core 6.6.1, so this gate is equivalent to checking
   * `panel.api.group.api.location.type === 'grid'`. Returns whether a
   * maximize/restore was performed.
   */
  async function toggleMaximize(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const panel = api.getPanel(panelId);
    if (!panel) return false;
    if (panel.api.location.type !== "grid") return false;

    setRestoring(true);
    try {
      if (panel.api.isMaximized()) {
        panel.api.exitMaximized();
      } else {
        panel.api.maximize();
      }
    } finally {
      setRestoring(false);
    }
    return true;
  }

  /**
   * Float a docked pane into an in-window draggable overlay (dockview-native
   * `addFloatingGroup`). Grid-gated. A float always keeps a header (drag
   * handle), so we clear `header.hidden`. Float geometry rides `toJSON`, so this
   * marks the session dirty. Multiple floats cascade so they don't stack.
   * (Phase 3a — opacity + headerless-restore + state persistence land in the
   * formal 3a/3b tasks; this is the verified-working core.)
   */
  async function floatPanel(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const panel = api.getPanel(panelId);
    if (!panel || panel.api.location.type !== "grid") return false;
    setRestoring(true);
    try {
      const n = api.groups.filter((g) => g.api.location.type === "floating").length;
      api.addFloatingGroup(panel, { width: 520, height: 360, x: 120 + n * 28, y: 120 + n * 28 });
      panel.api.group.header.hidden = false; // a float always keeps a drag handle
    } finally {
      setRestoring(false);
    }
    markDirty();
    return true;
  }

  /**
   * Dock a floating pane back into the grid. `moveTo({ position: "right" })`
   * with no target group creates a new right-edge GRID group and moves the panel
   * into it (traced: dockviewGroupPanelApi.moveTo -> accessor.addGroup +
   * moveGroupOrPanel). Floating-gated; marks dirty (geometry changes toJSON).
   */
  async function dockBack(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const panel = api.getPanel(panelId);
    if (!panel || panel.api.location.type !== "floating") return false;
    setRestoring(true);
    try {
      panel.api.group.api.moveTo({ position: "right" });
    } finally {
      setRestoring(false);
    }
    markDirty();
    return true;
  }

  /**
   * Split a clean pane: add a new panel of the given `panelType` as a NEW clean
   * neighbor to the right of the source group. Creates a fresh headerless
   * panel-state record so the new pane round-trips. Returns the new panel id, or
   * null when there is no loaded layout / source panel. Restoring-guarded around
   * the mutation; marks the session dirty afterward so the new pane is savable
   * (matches removePanelGuarded — splitting is a real user edit).
   *
   * Not currently wired to any UI: the dock context menu's Split item was removed
   * (a per-type submenu does not scale to a large component catalog; adding a
   * neighbor is done via the Add-Component menu + dockview drag-to-split). Kept
   * as tested store API for downstream apps / a future "add component as split"
   * flow to drive programmatically.
   */
  async function splitCleanNeighbor(
    sourcePanelId: Ulid,
    panelType: PanelType,
  ): Promise<Ulid | null> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    if (!loadedLayoutId.value) return null;
    const source = api.getPanel(sourcePanelId);
    if (!source) return null;

    const panelStateStore = usePanelStateStore();
    setRestoring(true);
    let newId: Ulid;
    try {
      const created = await panelStateStore.createPanel({
        layoutId: loadedLayoutId.value,
        panelType,
        assignmentState: "assigned",
        state: withHeaderless({}, true),
      });
      const def = panelRegistry.get(panelType);
      const added = api.addPanel({
        id: created.id,
        component: panelType,
        title: def?.title ?? panelType,
        position: { referenceGroup: source.api.group, direction: "right" },
      });
      added.api.group.header.hidden = true;
      newId = created.id;
    } finally {
      setRestoring(false);
    }
    markDirty();
    return newId;
  }

  /**
   * Throw away in-memory edits and re-load the persisted layout state.
   */
  async function discardChanges(): Promise<void> {
    if (!loadedLayoutId.value) return;
    await loadLayout(loadedLayoutId.value);
  }

  /**
   * Switch to a different workspace and load its default layout. Callers
   * must resolve any dirty state (via the UnsavedChangesDialog in Phase D)
   * before invoking this — this action does not prompt.
   */
  async function switchWorkspace(workspaceId: Ulid): Promise<void> {
    const workspaceStore = useWorkspaceStore();
    const layoutStore = useLayoutStore();
    const themeStore = useThemeStore();
    await workspaceStore.setCurrentWorkspace(workspaceId);
    // Re-resolve the theme so any workspace-bound theme picks up before the
    // new layout's panels mount and would otherwise paint with the previous
    // workspace's variant.
    await themeStore.loadInitial(workspaceId);
    await layoutStore.loadForWorkspace(workspaceId);
    const target = layoutStore.currentLayoutId;
    if (target) await loadLayout(target);
  }

  return {
    loadedLayoutId,
    dirty,
    restoring,
    getDockviewApi,
    bindDockview,
    unbindDockview,
    markDirty,
    clearDirty,
    setRestoring,
    loadLayout,
    applyHeaderlessGroups,
    backfillCleanMainPane,
    updateCurrentLayout,
    saveCurrentAsNewLayout,
    toggleHeaderless,
    removePanelGuarded,
    closeOthersInGroup,
    toggleMaximize,
    floatPanel,
    dockBack,
    splitCleanNeighbor,
    discardChanges,
    switchWorkspace,
  };
});

/**
 * Resolve a panel-state to its dockview `component` string + display title.
 * Module-scope: uses only module-level imports, no store-ref closure access.
 */
function resolvePanelComponent(ps: PanelState): { component: string; title: string } {
  if (!ps.panelType) return { component: UNASSIGNED_PANEL_TYPE, title: "Empty" };
  const def = panelRegistry.get(ps.panelType);
  if (def) return { component: ps.panelType, title: def.title };
  // Unregistered panel type — render the missing-panel placeholder so the
  // user can reassign or remove without losing the panel-state id.
  return { component: MISSING_PANEL_TYPE, title: "Missing" };
}

/**
 * Rebuild the dock from panel-state records. The `mainPane`-typed panel
 * (e.g. cesium) is added FIRST as its own group; the first remaining panel
 * docks to its `dockHint` side (default `'right'`) as a side group; the rest
 * stack `'within'` that side group as tabs. `dockHint` is read from
 * `PanelState.state` per panel.
 *
 * Module-scope (matching the current file): no closure over store refs.
 */
function rebuildFromPanelStates(api: DockviewApi, panelStates: PanelState[]): void {
  const mainType = panelRegistry.mainPanelType();
  const mainIndex = mainType ? panelStates.findIndex((ps) => ps.panelType === mainType) : -1;
  const ordered =
    mainIndex >= 0
      ? [panelStates[mainIndex]!, ...panelStates.filter((_, i) => i !== mainIndex)]
      : [...panelStates];

  let mainPanel: IDockviewPanel | undefined;
  let sideGroup: DockviewGroupPanel | undefined;

  ordered.forEach((ps, i) => {
    const { component, title } = resolvePanelComponent(ps);
    if (i === 0) {
      mainPanel = api.addPanel({ id: ps.id, component, title });
      return;
    }
    const dockHint =
      (ps.state.dockHint as "left" | "right" | "above" | "below" | undefined) ?? "right";
    if (!sideGroup) {
      const created = api.addPanel({
        id: ps.id,
        component,
        title,
        position: { referenceGroup: mainPanel!.api.group, direction: dockHint },
      });
      sideGroup = created.api.group;
    } else {
      api.addPanel({
        id: ps.id,
        component,
        title,
        position: { referenceGroup: sideGroup, direction: "within" },
      });
    }
  });
}

/** Test-only — clear the module-scope DockviewApi so specs can rebind. */
export function __unbindDockviewForTests(): void {
  dockviewApi.value = null;
}
