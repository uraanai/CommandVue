import type { Layout, PanelState, PanelType, Ulid } from "@/types/workspace";
import type { DockviewApi, DockviewGroupPanel, IDockviewPanel } from "dockview-vue";

import { nanoid } from "nanoid";
import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";

import { useNotify } from "@/composables/useNotify";
import { trackPopoutWindow, untrackPopoutWindow } from "@/composables/usePopoutWindows";
import {
  type FloatBox,
  floatWasHeaderless,
  getFloatAlpha as getFloatAlphaFromState,
  getFloatMaximized as getFloatMaximizedFromState,
  getFloatOrigin as getFloatOriginFromState,
  getFloatPrevBox as getFloatPrevBoxFromState,
  withFloatAlpha,
  withFloatMaximized,
  withFloatOrigin,
  withFloatPrevBox,
  withFloatPrevHeaderless,
} from "@/modules/panels/float";
import { isHeaderless, withHeaderless } from "@/modules/panels/headerless";
import { MISSING_PANEL_TYPE } from "@/modules/panels/missing";
import { panelRegistry } from "@/modules/panels/registry";
import { UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";

import { useLayoutStore } from "./layout";
import { type CapturedPanel, type MinimizedEntry, useMinimizedStore } from "./minimized";
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

/**
 * The internal dockview floating-group shape reached via an as-cast in
 * `findFloatingGroup` (dockview-core 6.6.1 exposes no public per-float resize
 * API). Only the members Track B Phase 4b uses are modeled.
 */
type FloatingGroupHandle = {
  readonly group: unknown;
  readonly overlay: { toJSON(): FloatBox };
  position(box: Partial<FloatBox>): void;
};

export const useSessionStore = defineStore("session", () => {
  const loadedLayoutId = ref<null | Ulid>(null);
  const dirty = ref(false);
  const restoring = ref(false);
  // Toast producer. `useNotify` is the module singleton (no setup context
  // needed) and no-ops until the outlet host installs the handle, so this is
  // safe to resolve at store init and call from any save action. Save toasts
  // live HERE (not at each caller) because both save actions fire from multiple
  // surfaces — MenuBar (⌘S / menu) and the workspace-switch unsaved-changes flow
  // — and a single store-level toast keeps that feedback consistent. Per-record
  // CRUD feedback (rename/delete/…) stays at its single dialog call site.
  const notify = useNotify();

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
    applyFloatAlphas(api);
    applyFloatMaximize(api);
    useMinimizedStore().clear(); // ephemeral tray: a load/switch empties it (D6)

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
   * Re-apply see-through opacity after a load. Like `applyHeaderlessGroups`,
   * dockview does not persist the `--cv-float-alpha` CSS var, so we set it from
   * the persisted `floatAlpha`. Opacity is a GROUP property, so we apply ONE alpha
   * per group — the ACTIVE tab's — rather than per panel: a group whose tabs hold
   * divergent persisted values (e.g. a tab dragged in and saved before it was
   * activated/reconciled) then reloads to a single, deterministic glass instead of
   * a last-writer-wins race over the shared var. Iterating GROUPS (not panels) also
   * sets the var BEFORE the header-actions component's `immediate` watcher reads it,
   * so an active dimmed tab never observes an unset var. Safe no-op when nothing is
   * dimmed; restoring-guarded so it never dirties. (The CSS only takes effect on a
   * `.dv-groupview-floating` group, so the var stays inert on a docked group until
   * it floats — where `floatPanel` re-applies it.)
   */
  function applyFloatAlphas(api: DockviewApi): void {
    setRestoring(true);
    try {
      const panelStateStore = usePanelStateStore();
      for (const group of api.groups) {
        const rep = group.activePanel ?? group.panels[0];
        if (!rep) continue;
        const alpha = getFloatAlphaFromState(panelStateStore.getState(rep.id)?.state);
        if (alpha < 1) group.element.style.setProperty("--cv-float-alpha", String(alpha));
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
    notify.success("Layout saved", { detail: `“${updated.name}” updated.` });
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
    notify.success("Layout saved", { detail: `New layout “${newLayout.name}” created.` });
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
        // A clean pane is single-panel — split this panel to its own group. A
        // pop-out window hosts ONE group with nowhere to split, so `api.addGroup()`
        // would land in the MAIN grid and yank the tab out of the pop-out (the
        // "vanishing tabs" bug). Refuse the split there; the menu disables it too.
        if (group.api.location.type === "popout") return;
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
   * Close EVERY panel in the target panel's group in one action — the group-level
   * complement to per-tab close (Track B Phase 4, the header "Close All" button).
   * Same mechanics as `closeOthersInGroup` minus the keep-the-target filter:
   * iterates a STABLE snapshot of `group.panels` (removing while iterating the
   * live array skips entries) and honors the empty-workspace guard. The target is
   * iterated LAST, so when this group is the whole layout the guard stops the
   * final removal and the surviving pane is the one the user invoked Close All
   * from (deterministic), not an arbitrary last-in-array member. Returns `false`
   * when nothing was removed. Restoring-guarded around the structural mutations;
   * marks dirty when it removed at least one panel (a real user edit).
   */
  async function closeAllInGroup(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const target = api.getPanel(panelId);
    if (!target) return false;

    // Target iterated LAST (see docstring). `getPanel` succeeded above, so the
    // target is always a member of this snapshot — there is no empty-group case.
    const others = target.api.group.panels.filter((p) => p.id !== panelId);
    const ordered = [...others, target];

    let removedAny = false;
    setRestoring(true);
    try {
      for (const member of ordered) {
        if (api.panels.length <= 1) break; // empty-workspace guard
        const panel = api.getPanel(member.id);
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
   * `addFloatingGroup`; position/size persist via `toJSON`). Grid-gated.
   * Multiple floats cascade so they don't stack. A float always keeps a header
   * (its drag handle), so we clear `header.hidden` AND persist `headerless:false`
   * — and remember the pre-float headerless flag (`floatPrevHeaderless`) so
   * `dockBack` can restore a clean pane's clean status. Marks dirty (geometry +
   * persisted state are both user-savable). Restoring-guarded so the
   * `addFloatingGroup` churn never false-dirties mid-mutation.
   */
  async function floatPanel(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const panel = api.getPanel(panelId);
    if (!panel || panel.api.location.type !== "grid") return false;
    setRestoring(true);
    try {
      const panelStateStore = usePanelStateStore();
      const wasHeaderless = isHeaderless(panelStateStore.getState(panelId)?.state);
      // Capture a surviving group-mate + this pane's tab index BEFORE the move so
      // `dockBack` can return it to its ORIGINAL tab group AND position. Undefined
      // when it's the sole pane (its group is destroyed) → dockBack opens a fresh group.
      const groupPanels = panel.api.group.panels;
      const originMate = groupPanels.find((p) => p.id !== panelId)?.id;
      const origin = originMate
        ? { mate: originMate, index: groupPanels.findIndex((p) => p.id === panelId) }
        : undefined;
      const n = api.groups.filter((g) => g.api.location.type === "floating").length;
      api.addFloatingGroup(panel, { width: 520, height: 360, x: 120 + n * 28, y: 120 + n * 28 });
      panel.api.group.header.hidden = false; // a float always keeps a drag handle
      // Re-apply any persisted opacity to the (possibly new) floating group element
      // so re-floating a dimmed pane restores its glass immediately, not only on
      // the next load (applyFloatAlphas).
      const alpha = getFloatAlphaFromState(panelStateStore.getState(panelId)?.state);
      if (alpha < 1) {
        panel.api.group.element.style.setProperty("--cv-float-alpha", String(alpha));
      }
      await panelStateStore.updateState(panelId, {
        // A fresh float is never maximized — clear any stale maximize state left
        // by a prior maximize → dock-back / reload-without-save.
        state: withFloatOrigin(
          withFloatPrevBox(
            withFloatMaximized(
              withFloatPrevHeaderless(
                withHeaderless(panelStateStore.getState(panelId)?.state, false),
                wasHeaderless,
              ),
              false,
            ),
            undefined,
          ),
          origin,
        ),
      });
    } finally {
      setRestoring(false);
    }
    markDirty();
    return true;
  }

  /**
   * Dock a floating pane back into the grid. Prefers returning the pane to its
   * ORIGINAL tab group — resolved via the surviving group-mate `floatPanel`
   * captured (`floatOrigin`); `panel.api.moveTo({ group })` re-joins it as a tab.
   * The origin only counts when it is a surviving, **headered** grid group: a CLEAN
   * (header-hidden, single-pane) origin is skipped, since re-joining it would make
   * an illegal 2-tab clean group with no tab strip. Falls back to
   * `moveTo({ position: "right" })` — a fresh right-edge GRID group (traced:
   * dockviewGroupPanelApi.moveTo -> accessor.addGroup + moveGroupOrPanel) — when the
   * origin is gone/clean (the pane was its group's sole member, the group has since
   * closed/floated/gone-clean, or it floated via native drag); only that fallback
   * restores the pane's pre-float clean status. (Fallback is group-level, so docking
   * one tab of a MULTI-tab float whose origin is gone brings the float's other tabs
   * along — pre-existing behavior, and the common single-tab case is unaffected.)
   * Floating-gated. Clears the maximize + origin flags. Marks dirty (toJSON changes).
   */
  async function dockBack(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const panel = api.getPanel(panelId);
    if (!panel || panel.api.location.type !== "floating") return false;
    setRestoring(true);
    try {
      const panelStateStore = usePanelStateStore();
      const state = panelStateStore.getState(panelId)?.state;
      // Resolve the origin group via the captured group-mate; only a SURVIVING grid
      // group counts (a floated/popped/closed mate falls back to a fresh group).
      const origin = getFloatOriginFromState(state);
      const originPanel = origin ? api.getPanel(origin.mate) : undefined;
      // Only a surviving, HEADERED grid group is a valid re-join target — re-joining
      // a CLEAN (header-hidden) single pane would make an illegal 2-tab clean group.
      const originGroup =
        originPanel &&
        originPanel.api.location.type === "grid" &&
        !originPanel.api.group.header.hidden
          ? originPanel.api.group
          : undefined;
      let dockedHeaderless: boolean;
      if (originGroup) {
        // Re-join at the ORIGINAL tab index (dockview clamps if the group shrank).
        panel.api.moveTo({ group: originGroup, index: origin?.index });
        dockedHeaderless = false; // a headered host group → the re-joined pane is a normal tab
      } else {
        const restoreClean = floatWasHeaderless(state);
        panel.api.group.api.moveTo({ position: "right" }); // new right-edge grid group
        // `panel.api.group` is a live getter — it now resolves to that NEW grid group.
        if (restoreClean) panel.api.group.header.hidden = true; // restore clean status
        dockedHeaderless = restoreClean;
      }
      await panelStateStore.updateState(panelId, {
        // Clear maximize + origin: a docked pane has no float to maximize and no
        // origin to return to (symmetry with floatPanel's fresh-float clear).
        state: withFloatOrigin(
          withFloatPrevBox(
            withFloatMaximized(
              withFloatPrevHeaderless(
                withHeaderless(panelStateStore.getState(panelId)?.state, dockedHeaderless),
                false,
              ),
              false,
            ),
            undefined,
          ),
          undefined,
        ),
      });
    } finally {
      setRestoring(false);
    }
    markDirty();
    return true;
  }

  /**
   * Pop content out into a SEPARATE browser window (Track B Phase 6a). dockview's
   * `addPopoutGroup` relocates LIVE DOM (appendChild — panel handles stay valid, no
   * re-instantiation) into a child window opened at `/popout.html` (a same-origin
   * blank page; dockview rejects cross-origin/data/blob URLs) and copies the
   * opener's stylesheets in. The inline theme TOKENS aren't in those sheets, so
   * each pop-out is registered with `usePopoutThemeSync`, which mirrors
   * `data-theme`/`-id`/`-density` + the inline `--*` props and keeps them live on
   * theme changes. MUST fire from a real user gesture; returns false when the
   * browser blocks the window. Marks dirty (pop-outs are in `toJSON`).
   *
   * `item` is the thing relocated — a single PANEL pops just that tab (its group
   * keeps the rest), a whole GROUP pops every tab; `rectFrom` is the on-screen group
   * whose bounds seed the new window's position. dockview opens each pop-out under a
   * window name unique per target group (`${dockviewId}-${groupId}`), so concurrent
   * pop-outs that all load `/popout.html` still land in SEPARATE windows — the URL
   * is just the blank template, the window NAME is what disambiguates them.
   *
   * NOTE: map panels' WebGL context can drop on the cross-document move; its
   * re-init is Phase 6b. Closing the pop-out window re-docks the content natively.
   */
  async function doPopOut(
    item: IDockviewPanel | DockviewGroupPanel,
    rectFrom: DockviewGroupPanel,
  ): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const rect = rectFrom.element.getBoundingClientRect();
    setRestoring(true);
    let opened = false;
    try {
      opened = await api.addPopoutGroup(item, {
        // `position` is VIEWPORT-relative: dockview adds `window.screenX/screenY`
        // itself when opening the window (its own default path uses
        // `getBoundingClientRect()`), so adding it here too would double the offset
        // and open far off-target on any window not at screen origin.
        position: {
          left: Math.max(0, Math.round(rect.left)) + 40,
          top: Math.max(0, Math.round(rect.top)) + 80,
          width: Math.max(480, Math.round(rect.width)),
          height: Math.max(360, Math.round(rect.height)),
        },
        popoutUrl: "/popout.html",
        onDidOpen: ({ window: win }) => trackPopoutWindow(win),
        onWillClose: ({ window: win }) => untrackPopoutWindow(win),
      });
    } finally {
      setRestoring(false);
    }
    if (opened) markDirty();
    return opened;
  }

  /** Pop out the WHOLE group that holds `panelId` (every tab → one window). */
  async function popOutGroup(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const panel = api.getPanel(panelId);
    if (!panel) return false;
    return doPopOut(panel.api.group, panel.api.group);
  }

  /**
   * Pop out ONLY panel `panelId` (one tab); its group keeps the rest docked. Mirrors
   * `floatPanel` / `minimizePanel`: passing the panel (not its group) to
   * `addPopoutGroup` relocates just that tab into a fresh pop-out group. When the
   * panel is its group's sole tab this is equivalent to `popOutGroup`.
   */
  async function popOutPanel(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const panel = api.getPanel(panelId);
    if (!panel) return false;
    return doPopOut(panel, panel.api.group);
  }

  /**
   * Cross-window relocation (Track B Phase 7). Move a SINGLE panel's live DOM into
   * another window's group via dockview's cross-document `moveTo` — "Send to
   * window" from the menu. `targetGroupId` is a concrete pop-out group id, or
   * `null` for the MAIN window (re-use a grid group, or create one if every group
   * is currently popped/floated).
   *
   * The destination group is re-resolved by id at call time (never cached — a
   * pop-out may have closed since the menu opened; §7.3) and the move is
   * restoring-guarded so the deferred `onDidLayoutChange` doesn't double-fire.
   *
   * NOTE: dockview relocates the live DOM (appendChild — panel handles stay valid),
   * and in Chromium the WebGL context of a Cesium / MapLibre canvas SURVIVES the
   * cross-document move (camera/zoom preserved too), so no viewer re-init is needed
   * — runtime-verified for both the pop-out and this cross-window move. Marks dirty.
   */
  function sendPanelToWindow(panelId: Ulid, targetGroupId: string | null): boolean {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const panel = api.getPanel(panelId);
    if (!panel) return false;

    // Re-resolve the destination from the LIVE group list by id (never cache — a
    // pop-out may have closed since the menu opened). `api.groups` are concrete
    // `DockviewGroupPanel`s (what `moveTo` wants); `api.getGroup` returns the
    // narrower interface, hence the find.
    const dest: DockviewGroupPanel | undefined =
      targetGroupId === null
        ? (api.groups.find((g) => g.api.location.type === "grid" && g !== panel.api.group) ??
          api.addGroup())
        : api.groups.find((g) => g.id === targetGroupId);
    // Stale / closed target, or it's already the panel's group → nothing to do.
    if (!dest || dest === panel.api.group) return false;

    setRestoring(true);
    try {
      panel.api.moveTo({ group: dest });
    } finally {
      setRestoring(false);
    }
    markDirty();
    return true;
  }

  /**
   * Set a floating GROUP's see-through opacity (the background alpha of its glass;
   * 0 = fully transparent so only the content shows over the map, 1 = solid).
   *
   * Opacity is a GROUP property, not a per-window one: the glass `--cv-float-alpha`
   * var lives on the ONE shared group element, so a multi-tab float renders every
   * tab at the same alpha. We therefore set the var on the group element AND
   * persist the same `floatAlpha` to EVERY panel in the group — so switching tabs
   * reads a consistent value (a per-panel value would snap the opacity control
   * back to the new tab's default while the group's glass stayed put). Persisting
   * per-panel is how the alpha survives reload (re-applied by `applyFloatAlphas`).
   * Clamped to [0, 1]; marks dirty once. No location gate — the var is inert on a
   * docked group (CSS scoped to `.dv-groupview-floating`), and persisting now means
   * a later re-float restores the dim. No-op for unknown id.
   */
  async function setFloatAlpha(panelId: Ulid, value: number): Promise<void> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const panel = api.getPanel(panelId);
    if (!panel) return;
    const clamped = Math.min(1, Math.max(0, value));
    setRestoring(true);
    try {
      const group = panel.api.group;
      group.element.style.setProperty("--cv-float-alpha", String(clamped));
      const panelStateStore = usePanelStateStore();
      // Persist to every tab in the group (group-wide opacity), in PARALLEL so the
      // guarded window doesn't widen with tab count. Reads snapshot synchronously at
      // map-build time, before any await, so the writes don't race each other.
      await Promise.all(
        group.panels.map((p) =>
          panelStateStore.updateState(p.id, {
            state: withFloatAlpha(panelStateStore.getState(p.id)?.state, clamped),
          }),
        ),
      );
    } finally {
      setRestoring(false);
    }
    markDirty();
  }

  /**
   * Reconcile a float's now-active tab with the GROUP's shared opacity (called by
   * the header on every float active-panel change). Float alpha is group-wide but
   * persisted per-panel, so a tab DRAGGED into a float keeps its own value — which
   * would desync the opacity control from the group's actual glass on activation.
   *
   * Reads the group's APPLIED alpha (the `--cv-float-alpha` var = the visible truth):
   *  - var SET → the active tab adopts the group's value (a dragged-in tab takes the
   *    group's look — dimmed OR solid).
   *  - var UNSET on a LONE float (a tab torn off into its own new group) → push the
   *    tab's OWN persisted dim onto the fresh var instead of snapping it to solid, so
   *    a dimmed window keeps its dim when it forms a new group.
   *  - var UNSET on a multi-tab group → reads as solid (1); a dragged-in tab adopts
   *    solid.
   *
   * NO `restoring` guard: this writes only panel STATE (never dockview's `toJSON`, so
   * it fires no `onDidLayoutChange`) and never calls `markDirty`, so it is dirty-neutral
   * by construction. Guarding it would only risk swallowing a concurrent, legitimate
   * `markDirty` — e.g. the very tab-drag that triggered this reconcile. The adopted
   * value is committed DURABLY to panel state (it survives Discard), consistent with
   * `setFloatAlpha`'s persistence model. No-op when in sync, unbound, or off a float.
   */
  async function syncActiveFloatAlpha(panelId: Ulid): Promise<void> {
    const api = dockviewApi.value;
    if (!api) return;
    const panel = api.getPanel(panelId);
    if (!panel || panel.api.location.type !== "floating") return;
    const group = panel.api.group;
    const panelStateStore = usePanelStateStore();
    const current = getFloatAlphaFromState(panelStateStore.getState(panelId)?.state);
    const applied = group.element.style.getPropertyValue("--cv-float-alpha").trim();
    if (applied === "" && group.panels.length <= 1) {
      // Lone float with no glass set (e.g. a torn-off tab): keep its own dim.
      if (current < 1) group.element.style.setProperty("--cv-float-alpha", String(current));
      return;
    }
    const parsed = applied === "" ? 1 : Number(applied);
    const groupAlpha = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1;
    if (Math.abs(current - groupAlpha) < 1e-6) return; // already in sync
    await panelStateStore.updateState(panelId, {
      state: withFloatAlpha(panelStateStore.getState(panelId)?.state, groupAlpha),
    });
  }

  /** Current persisted float alpha for a panel (1 = solid when unset). */
  function getFloatAlpha(panelId: Ulid): number {
    return getFloatAlphaFromState(usePanelStateStore().getState(panelId)?.state);
  }

  /**
   * Locate the live floating-group panel for a panel via dockview's INTERNAL
   * `floatingGroups` list. dockview-core 6.6.1 exposes NO public API to resize or
   * reposition an existing floating group, so we reach the internal
   * `DockviewComponent.floatingGroups` (each entry has `group`, `overlay.toJSON()`
   * and `position(box)`) through an as-cast. This is the one brittle dockview
   * coupling in Track B — re-verify against the d.ts on any dockview bump
   * (CLAUDE.md library-gotcha rule). Returns undefined if not found.
   */
  function findFloatingGroup(
    api: DockviewApi,
    panel: IDockviewPanel,
  ): FloatingGroupHandle | undefined {
    const internal = api as unknown as {
      component?: { floatingGroups?: FloatingGroupHandle[] };
    };
    return internal.component?.floatingGroups?.find((fg) => fg.group === panel.api.group);
  }

  /**
   * Maximize a floating window to fill the dock area, or restore it to its prior
   * box if already maximized (Track B Phase 4b). Custom because dockview's native
   * maximize is grid-only; here we snapshot the float's `overlay.toJSON()` box,
   * `position()` it to the full `api.width`/`api.height`, and persist
   * `floatMaximized` + `floatPrevBox` so Restore — and reload — returns it exactly.
   *
   * The fill is exact because `floating-group-bounds="boundedWithinViewport"`
   * zeroes the overlay's min-in-viewport offset, so a fill to the container's exact
   * width/height is not clamped inward. NB: `api.width`/`api.height` are the
   * GRIDVIEW size; they equal the floating-overlay host only because CommandVue
   * mounts no shell edge panels — a fork that adds them must revisit the source.
   *
   * Floating-gated; `position()` resizes in place (no DOM reparent, so WebGL
   * survives). Restoring-guarded as defensive belt-and-suspenders (a programmatic
   * `position()` does not actually fire `onDidLayoutChange`); the explicit
   * `markDirty()` is what flags the savable change (like setFloatAlpha).
   */
  async function toggleFloatMaximize(panelId: Ulid): Promise<boolean> {
    const api = dockviewApi.value;
    if (!api) throw new Error("Dockview API not bound");
    const panel = api.getPanel(panelId);
    if (!panel || panel.api.location.type !== "floating") return false;
    const fg = findFloatingGroup(api, panel);
    if (!fg) return false;

    const panelStateStore = usePanelStateStore();
    const state = panelStateStore.getState(panelId)?.state;
    setRestoring(true);
    try {
      if (getFloatMaximizedFromState(state)) {
        // Restore to the pre-maximize box; fall back to the float cascade default
        // if the box is somehow missing (hand-edited state) so Restore ALWAYS
        // un-maximizes the window rather than leaving it stuck full-size.
        const prev = getFloatPrevBoxFromState(state) ?? {
          top: 120,
          left: 120,
          width: 520,
          height: 360,
        };
        fg.position(prev);
        await panelStateStore.updateState(panelId, {
          state: withFloatMaximized(withFloatPrevBox(state, undefined), false),
        });
      } else {
        const prev = fg.overlay.toJSON();
        fg.position({ top: 0, left: 0, width: api.width, height: api.height });
        await panelStateStore.updateState(panelId, {
          state: withFloatMaximized(withFloatPrevBox(state, prev), true),
        });
      }
    } finally {
      setRestoring(false);
    }
    markDirty();
    return true;
  }

  /** Whether a panel's floating window is currently maximized. */
  function getFloatMaximized(panelId: Ulid): boolean {
    return getFloatMaximizedFromState(usePanelStateStore().getState(panelId)?.state);
  }

  /** Snapshot one panel's id/type/title + a clone of its `PanelState.state`
   *  (Phase 4c) — the serializable capture both minimize paths share. */
  function capturePanel(m: { id: Ulid; title?: string }): CapturedPanel {
    const ps = usePanelStateStore().getState(m.id);
    return {
      id: m.id,
      panelType: ps?.panelType ?? null,
      title: m.title ?? "",
      state: structuredClone(ps?.state ?? {}),
    };
  }

  /** Resolve a captured panel to its dockview component + title (Phase 4c). */
  function componentFor(captured: CapturedPanel): { component: string; title: string } {
    if (!captured.panelType) {
      return { component: UNASSIGNED_PANEL_TYPE, title: captured.title || "Empty" };
    }
    const def = panelRegistry.get(captured.panelType);
    return def
      ? { component: captured.panelType, title: captured.title || def.title }
      : { component: MISSING_PANEL_TYPE, title: captured.title || "Missing" };
  }

  /**
   * Minimize the GROUP containing `panelId` into the tray (Track B Phase 4c).
   * Captures every panel's id/type/title + a `structuredClone` of its
   * `PanelState.state` and `appliedPresetIds` (so restore round-trips per-panel
   * state), the group location, a floating box (if floating), and a best-effort
   * grid re-dock anchor — THEN removes the group's panels via `api.removePanel`.
   * The PanelState RECORDS survive the removal (no removal→delete path exists), so
   * restore re-adds each panel by its original id and each re-mounted panel
   * re-runs its own restore hook + preset cascade. Restoring-guarded; EPHEMERAL —
   * does NOT markDirty (a minimize alone must not make the layout savable). Returns
   * the entry (fresh nanoid id), or null when there's nothing to minimize.
   */
  function minimizeGroup(panelId: Ulid): MinimizedEntry | null {
    const api = dockviewApi.value;
    if (!api) return null;
    const panel = api.getPanel(panelId);
    if (!panel) return null;
    const group = panel.api.group;
    const location = group.api.location.type;
    if (location !== "grid" && location !== "floating") return null; // popout/edge: skip

    const panelStateStore = usePanelStateStore();
    const members = [...group.panels];
    if (members.length === 0) return null;
    const panels: CapturedPanel[] = members.map((m) => capturePanel(m));
    const activePanelId = group.activePanel?.id ?? members[0]!.id;
    const activeType = panelStateStore.getState(activePanelId)?.panelType ?? null;
    const def = activeType ? panelRegistry.get(activeType) : undefined;
    const floatBox =
      location === "floating" ? findFloatingGroup(api, panel)?.overlay.toJSON() : undefined;
    // Best-effort grid re-dock anchor: a panel in ANOTHER group (it survives this
    // removal), so restore can dock the group beside it; default side 'right'.
    const referencePanelId = api.panels.find((p) => p.api.group !== group)?.id;

    const entry: MinimizedEntry = {
      id: nanoid(),
      location,
      floatBox,
      originAnchor: { referencePanelId, direction: "right" },
      panels,
      activePanelId,
      title: api.getPanel(activePanelId)?.title ?? def?.title ?? "Window",
    };

    const wasDirty = dirty.value;
    setRestoring(true);
    try {
      for (const m of members) {
        const p = api.getPanel(m.id);
        if (p) api.removePanel(p);
      }
    } finally {
      setRestoring(false);
    }
    // dockview fires `onDidLayoutChange` via `queueMicrotask` AFTER this sync
    // block, so the (sync-scoped) restoring guard can't suppress its `markDirty`.
    // Minimize is ephemeral view state — re-clear dirty on a microtask queued
    // after dockview's (FIFO order), but ONLY if the layout was already clean, so
    // a real pre-existing dirty flag is preserved.
    if (!wasDirty) void Promise.resolve().then(() => clearDirty());
    return entry;
  }

  /**
   * Minimize a SINGLE panel — one tab — into the tray (Track B Phase 4c). The rest
   * of its group stays docked. When the panel is its group's SOLE member this is
   * identical to a whole-group minimize, so it delegates to `minimizeGroup`.
   * Otherwise it captures just this panel and anchors it `within` a surviving
   * sibling, so `restoreMinimized` re-joins the SAME group wherever it then lives
   * (grid OR float) — no float box needed. Removes only this panel via
   * `api.removePanel`; restoring-guarded; ephemeral (no markDirty, same deferred
   * clear as `minimizeGroup`). Returns the entry (fresh nanoid id), or null.
   */
  function minimizePanel(panelId: Ulid): MinimizedEntry | null {
    const api = dockviewApi.value;
    if (!api) return null;
    const panel = api.getPanel(panelId);
    if (!panel) return null;
    const group = panel.api.group;
    const location = group.api.location.type;
    if (location !== "grid" && location !== "floating") return null; // popout/edge: skip
    const sibling = group.panels.find((p) => p.id !== panelId);
    if (!sibling) return minimizeGroup(panelId); // sole member → whole-group minimize
    const index = group.panels.findIndex((p) => p.id === panelId); // restore in place

    const captured = capturePanel(panel);
    const def = captured.panelType ? panelRegistry.get(captured.panelType) : undefined;
    const entry: MinimizedEntry = {
      id: nanoid(),
      location: "grid", // re-joins via the within-anchor — lands wherever the sibling is
      originAnchor: { referencePanelId: sibling.id, direction: "within", index },
      panels: [captured],
      activePanelId: panel.id,
      title: panel.title ?? def?.title ?? "Window",
    };

    const wasDirty = dirty.value;
    setRestoring(true);
    try {
      api.removePanel(panel);
    } finally {
      setRestoring(false);
    }
    if (!wasDirty) void Promise.resolve().then(() => clearDirty());
    return entry;
  }

  /**
   * Restore a minimized group back into the dock (Track B Phase 4c). Re-adds each
   * captured panel BY ITS ORIGINAL ID — the PanelState records survived minimize,
   * so each re-mounted panel re-runs its own restore hook + preset cascade from the
   * intact record. The first panel opens a new group beside the captured anchor
   * (best-effort; a fresh group if the anchor is gone), the rest stack as tabs. A
   * floating group is re-floated at its captured box (alpha re-applied); a clean
   * single pane gets its header re-hidden. Restoring-guarded; ephemeral — no
   * markDirty. Returns false only when the API is unbound / the entry is empty.
   */
  function restoreMinimized(entry: MinimizedEntry): boolean {
    const api = dockviewApi.value;
    if (!api) return false;
    const [first, ...rest] = entry.panels;
    if (!first) return false;

    const wasDirty = dirty.value;
    setRestoring(true);
    try {
      const refPanel = entry.originAnchor.referencePanelId
        ? api.getPanel(entry.originAnchor.referencePanelId)
        : undefined;
      const firstComp = componentFor(first);
      const added = api.addPanel({
        id: first.id,
        component: firstComp.component,
        title: firstComp.title,
        ...(refPanel
          ? {
              position: {
                referenceGroup: refPanel.api.group,
                direction: entry.originAnchor.direction,
                // Per-tab restore: re-insert at the original tab index (undefined for
                // a whole-group restore → appended, as before). dockview clamps.
                index: entry.originAnchor.index,
              },
            }
          : {}),
      });
      for (const m of rest) {
        const comp = componentFor(m);
        api.addPanel({
          id: m.id,
          component: comp.component,
          title: comp.title,
          position: { referenceGroup: added.api.group, direction: "within" },
        });
      }

      if (entry.location === "floating") {
        const box = entry.floatBox;
        // Float the whole GROUP (not the single panel): `addFloatingGroup(panel)`
        // would move only that panel into a new float, orphaning the rest in the
        // grid — wrong for a multi-tab float (a user can drag tabs onto a float).
        api.addFloatingGroup(
          added.api.group,
          box
            ? { width: box.width, height: box.height, x: box.left ?? 120, y: box.top ?? 120 }
            : { width: 520, height: 360, x: 120, y: 120 },
        );
        added.api.group.header.hidden = false; // a float always keeps its header
        if (box) findFloatingGroup(api, added)?.position(box); // exact anchor fidelity
        const alpha = getFloatAlphaFromState(first.state);
        if (alpha < 1) added.api.group.element.style.setProperty("--cv-float-alpha", String(alpha));
      } else if (
        entry.panels.length === 1 &&
        entry.originAnchor.direction !== "within" &&
        isHeaderless(first.state)
      ) {
        // Restore a clean single pane to its OWN new group. Skipped for a
        // within-restore (a minimized tab re-joining a sibling's group), where
        // hiding the header would hide it for the whole host group.
        added.api.group.header.hidden = true;
      }

      api.getPanel(entry.activePanelId)?.api.setActive();
    } finally {
      setRestoring(false);
    }
    // Same deferred-dirty handling as minimizeGroup: dockview's microtask
    // `onDidLayoutChange` would dirty a clean layout after the sync guard resets.
    if (!wasDirty) void Promise.resolve().then(() => clearDirty());
    return true;
  }

  /**
   * Re-apply float maximize after a load: a maximized float is serialized at its
   * FILLED box (`toJSON().floatingGroups[].position`), so it reloads maximized —
   * but sized to the OLD dock area. Re-fill any `floatMaximized` float to the
   * CURRENT `api.width`/`api.height` so it still fills after a between-session
   * viewport resize. `floatPrevBox` (the pre-maximize box) is untouched.
   * Restoring-guarded so it never dirties; safe no-op when nothing is maximized.
   * Skips entirely if the dock has no size yet (would otherwise fill to 0×0). The
   * skip is fully correct for the common saved-while-maximized case (the float is
   * already serialized at its filled box); the only gap is the rare
   * maximize → no-save → reload-at-0×0 path, where the float reloads at its
   * pre-maximize box with the flag still set until the user toggles (acceptable —
   * dockview's `onReady` normally fires with the dock mounted and sized).
   */
  function applyFloatMaximize(api: DockviewApi): void {
    if (!(api.width > 0) || !(api.height > 0)) return;
    setRestoring(true);
    try {
      const panelStateStore = usePanelStateStore();
      for (const ps of panelStateStore.listForLayout()) {
        if (!getFloatMaximizedFromState(ps.state)) continue;
        const panel = api.getPanel(ps.id);
        if (!panel || panel.api.location.type !== "floating") continue;
        const fg = findFloatingGroup(api, panel);
        if (fg) fg.position({ top: 0, left: 0, width: api.width, height: api.height });
      }
    } finally {
      setRestoring(false);
    }
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

  /**
   * Switch the active layout WITHIN the current workspace: point the layout
   * store at it (persists the current-layout pointer) and load its dock state.
   * Like {@link switchWorkspace}, callers must resolve any dirty state (via the
   * UnsavedChangesDialog) first — this action does not prompt.
   */
  async function switchLayout(layoutId: Ulid): Promise<void> {
    if (layoutId === loadedLayoutId.value) return;
    await useLayoutStore().setCurrentLayout(layoutId);
    await loadLayout(layoutId);
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
    closeAllInGroup,
    toggleMaximize,
    floatPanel,
    dockBack,
    popOutGroup,
    popOutPanel,
    sendPanelToWindow,
    setFloatAlpha,
    syncActiveFloatAlpha,
    getFloatAlpha,
    toggleFloatMaximize,
    getFloatMaximized,
    minimizeGroup,
    minimizePanel,
    restoreMinimized,
    splitCleanNeighbor,
    discardChanges,
    switchWorkspace,
    switchLayout,
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
