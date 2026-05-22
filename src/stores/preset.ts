import type { CreatePresetInput, UpdatePresetInput } from "@/modules/storage/presetRepo";
import type { Preset } from "@/types/preset";
import type { PanelType, Ulid } from "@/types/workspace";

import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";

import { presetTypeRegistry } from "@/modules/presets/registry";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { presetRepo } from "@/modules/storage/presetRepo";

import { usePanelStateStore } from "./panelState";

/**
 * Preset store — owns the list of presets (global + current-workspace-scoped),
 * plus the apply/remove dispatching that propagates a runtime change to every
 * panel referencing the affected preset.
 *
 * The store does NOT cache a per-panel apply state; the panel components
 * themselves watch `panelStateStore.getState(panelId).appliedPresetIds` and
 * dispatch via the preset-type registry on change.
 */
export const usePresetStore = defineStore("preset", () => {
  const presets = shallowRef<Preset[]>([]);
  const loadedWorkspaceId = ref<null | Ulid>(null);

  const globalPresets = computed(() => presets.value.filter((p) => p.workspaceId === null));
  const workspacePresets = computed(() =>
    presets.value.filter(
      (p) => p.workspaceId !== null && p.workspaceId === loadedWorkspaceId.value,
    ),
  );

  async function loadAll(): Promise<void> {
    presets.value = await presetRepo.list();
  }

  async function loadForWorkspace(workspaceId: Ulid): Promise<void> {
    loadedWorkspaceId.value = workspaceId;
    const [globals, scoped] = await Promise.all([
      presetRepo.listGlobal(),
      presetRepo.listForWorkspace(workspaceId),
    ]);
    presets.value = [...globals, ...scoped];
  }

  function presetsForPanel(panelType: PanelType, workspaceId: null | Ulid): Preset[] {
    const applicableTypes = new Set(presetTypeRegistry.listFor(panelType).map((d) => d.id));
    return presets.value.filter(
      (p) =>
        applicableTypes.has(p.presetTypeId) &&
        (p.workspaceId === null || p.workspaceId === workspaceId),
    );
  }

  function getPreset(id: Ulid): Preset | undefined {
    return presets.value.find((p) => p.id === id);
  }

  async function createPreset(input: CreatePresetInput): Promise<Preset> {
    const created = await presetRepo.create(input);
    await refreshLocalCache();
    return created;
  }

  async function updatePreset(id: Ulid, patch: UpdatePresetInput): Promise<Preset> {
    const updated = await presetRepo.update(id, patch);
    await refreshLocalCache();
    await reapplyToAllPanels(id);
    return updated;
  }

  async function deletePreset(id: Ulid, opts: { force?: boolean } = {}): Promise<void> {
    await presetRepo.delete(id, opts);
    await refreshLocalCache();
  }

  async function duplicatePreset(
    id: Ulid,
    opts: { name?: string; workspaceId?: null | Ulid } = {},
  ): Promise<Preset> {
    const dup = await presetRepo.duplicate(id, opts);
    await refreshLocalCache();
    return dup;
  }

  /**
   * Apply a preset to a panel. Writes the panel-state record (cascading
   * order semantics live in `panelStateRepo.applyPreset`), then runs the
   * preset type's `applyToPanel` against the live panel instance.
   */
  async function applyToPanel(panelId: Ulid, presetId: Ulid): Promise<void> {
    const preset = getPreset(presetId);
    if (!preset) return;
    const def = presetTypeRegistry.get(preset.presetTypeId);
    if (!def) return;
    const panelStateStore = usePanelStateStore();
    await panelStateStore.applyPreset(panelId, presetId);
    await Promise.resolve(def.applyToPanel(panelId, preset.config as Record<string, unknown>));
  }

  async function removeFromPanel(panelId: Ulid, presetId: Ulid): Promise<void> {
    const preset = getPreset(presetId);
    const panelStateStore = usePanelStateStore();
    await panelStateStore.removePreset(panelId, presetId);
    if (preset) {
      const def = presetTypeRegistry.get(preset.presetTypeId);
      if (def?.removeFromPanel) {
        await Promise.resolve(
          def.removeFromPanel(panelId, preset.config as Record<string, unknown>),
        );
      }
    }
  }

  /**
   * Re-apply a preset to every panel-state that references it. Called from
   * `updatePreset` so a live edit of a preset propagates to all consumers.
   */
  async function reapplyToAllPanels(presetId: Ulid): Promise<void> {
    const preset = getPreset(presetId);
    if (!preset) return;
    const def = presetTypeRegistry.get(preset.presetTypeId);
    if (!def) return;
    // Scan every panel-state and re-apply where appliedPresetIds includes presetId.
    // panelStateRepo doesn't expose listAll; we iterate via the repo for now.
    // The set is small in practice (one workspace × a handful of layouts × a
    // handful of panels) so this is cheap.
    const db = await import("@/modules/storage/db").then((m) => m.getDb());
    const all = await db.getAll("panel-states");
    for (const panel of all) {
      if (!panel.appliedPresetIds.includes(presetId)) continue;
      await Promise.resolve(def.applyToPanel(panel.id, preset.config as Record<string, unknown>));
    }
  }

  async function refreshLocalCache(): Promise<void> {
    if (loadedWorkspaceId.value) {
      await loadForWorkspace(loadedWorkspaceId.value);
    } else {
      await loadAll();
    }
  }

  return {
    presets,
    loadedWorkspaceId,
    globalPresets,
    workspacePresets,
    loadAll,
    loadForWorkspace,
    presetsForPanel,
    getPreset,
    createPreset,
    updatePreset,
    deletePreset,
    duplicatePreset,
    applyToPanel,
    removeFromPanel,
  };
});

void panelStateRepo; // ensure tree-shake retains the symbol for future direct use
