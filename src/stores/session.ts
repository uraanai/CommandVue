import type { Layout, PanelState, Ulid } from "@/types/workspace";
import type { DockviewApi } from "dockview-vue";

import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";

import { panelRegistry } from "@/modules/panels/registry";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";

import { useLayoutStore } from "./layout";
import { usePanelStateStore } from "./panelState";
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
    dirty.value = true;
  }

  function clearDirty(): void {
    dirty.value = false;
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

    loadedLayoutId.value = layoutId;
    dirty.value = false;
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
    await workspaceStore.setCurrentWorkspace(workspaceId);
    await layoutStore.loadForWorkspace(workspaceId);
    const target = layoutStore.currentLayoutId;
    if (target) await loadLayout(target);
  }

  return {
    loadedLayoutId,
    dirty,
    getDockviewApi,
    bindDockview,
    unbindDockview,
    markDirty,
    clearDirty,
    loadLayout,
    updateCurrentLayout,
    saveCurrentAsNewLayout,
    discardChanges,
    switchWorkspace,
  };
});

function rebuildFromPanelStates(api: DockviewApi, panelStates: PanelState[]): void {
  for (const ps of panelStates) {
    const component = ps.panelType ?? "__unassigned__";
    const title = ps.panelType ? (panelRegistry.get(ps.panelType)?.title ?? ps.panelType) : "Empty";
    api.addPanel({ id: ps.id, component, title });
  }
}

/** Test-only — clear the module-scope DockviewApi so specs can rebind. */
export function __unbindDockviewForTests(): void {
  dockviewApi.value = null;
}
