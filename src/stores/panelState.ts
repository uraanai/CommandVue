import type {
  CreatePanelStateInput,
  UpdatePanelStateInput,
} from "@/modules/storage/panelStateRepo";
import type { PanelAssignmentState, PanelState, PanelType, Ulid } from "@/types/workspace";

import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";

import { panelStateRepo } from "@/modules/storage/panelStateRepo";

/**
 * Panel-state store — caches the panel-state records for the currently
 * loaded layout. Keyed by panel id (the same id Dockview uses for its
 * `addPanel({ id, ... })` lookups).
 *
 * The map is a `shallowRef<Map>` because the values are POJOs; mutating
 * via `.set(...)` then triggering a manual re-assign keeps Vue's
 * reactivity quiet for large layouts.
 */
export const usePanelStateStore = defineStore("panelState", () => {
  const statesByPanelId = shallowRef<Map<Ulid, PanelState>>(new Map());
  const loadedLayoutId = ref<null | Ulid>(null);

  function snapshot(): Map<Ulid, PanelState> {
    return new Map(statesByPanelId.value);
  }

  async function loadForLayout(layoutId: Ulid): Promise<void> {
    const list = await panelStateRepo.listByLayout(layoutId);
    const next = new Map<Ulid, PanelState>();
    for (const ps of list) next.set(ps.id, ps);
    statesByPanelId.value = next;
    loadedLayoutId.value = layoutId;
  }

  function getState(panelId: Ulid): PanelState | undefined {
    return statesByPanelId.value.get(panelId);
  }

  async function updateState(panelId: Ulid, patch: UpdatePanelStateInput): Promise<PanelState> {
    const updated = await panelStateRepo.update(panelId, patch);
    const next = snapshot();
    next.set(updated.id, updated);
    statesByPanelId.value = next;
    return updated;
  }

  async function assignComponent(
    panelId: Ulid,
    panelType: PanelType,
    nextAssignmentState: PanelAssignmentState = "assigned",
  ): Promise<PanelState> {
    return updateState(panelId, {
      panelType,
      assignmentState: nextAssignmentState,
    });
  }

  async function clearComponent(panelId: Ulid): Promise<PanelState> {
    return updateState(panelId, {
      panelType: null,
      assignmentState: "empty",
      state: {},
    });
  }

  async function createPanel(input: CreatePanelStateInput): Promise<PanelState> {
    const created = await panelStateRepo.create(input);
    if (loadedLayoutId.value === input.layoutId) {
      const next = snapshot();
      next.set(created.id, created);
      statesByPanelId.value = next;
    }
    return created;
  }

  function createEmptyPanel(layoutId: Ulid): Promise<PanelState> {
    return createPanel({ layoutId, panelType: null, assignmentState: "empty" });
  }

  async function deletePanel(panelId: Ulid): Promise<void> {
    await panelStateRepo.delete(panelId);
    const next = snapshot();
    next.delete(panelId);
    statesByPanelId.value = next;
  }

  async function applyPreset(panelId: Ulid, presetId: Ulid): Promise<PanelState> {
    const updated = await panelStateRepo.applyPreset(panelId, presetId);
    const next = snapshot();
    next.set(updated.id, updated);
    statesByPanelId.value = next;
    return updated;
  }

  async function removePreset(panelId: Ulid, presetId: Ulid): Promise<PanelState> {
    const updated = await panelStateRepo.removePreset(panelId, presetId);
    const next = snapshot();
    next.set(updated.id, updated);
    statesByPanelId.value = next;
    return updated;
  }

  function listForLayout(): PanelState[] {
    return Array.from(statesByPanelId.value.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  return {
    statesByPanelId,
    loadedLayoutId,
    loadForLayout,
    getState,
    updateState,
    assignComponent,
    clearComponent,
    createPanel,
    createEmptyPanel,
    deletePanel,
    applyPreset,
    removePreset,
    listForLayout,
  };
});
