import type { Command } from "../types";
import type { CreatePresetInput, UpdatePresetInput } from "@/modules/storage/presetRepo";
import type { Preset } from "@/types/preset";
import type { Ulid } from "@/types/workspace";

import { getDb } from "@/modules/storage/db";
import { usePresetStore } from "@/stores/preset";
import { useWorkspaceStore } from "@/stores/workspace";

import { makeCommand } from "../factories";

/** Re-sync the preset store's `shallowRef` cache for the active workspace. */
async function reloadPresetCache(): Promise<void> {
  const wsId = useWorkspaceStore().currentWorkspaceId;
  if (wsId) await usePresetStore().loadForWorkspace(wsId);
}

export function makeCreatePresetCommand(
  input: CreatePresetInput,
  onCreated?: (preset: Preset) => void,
): Command {
  const presetStore = usePresetStore();
  let createdId: null | Ulid = null;
  return makeCommand({
    label: "Create preset",
    scope: "preset",
    category: "create",
    async redo() {
      const created = await presetStore.createPreset(input);
      createdId = created.id;
      onCreated?.(created);
    },
    async undo() {
      if (createdId !== null) await presetStore.deletePreset(createdId, { force: true });
    },
  });
}

/**
 * Undoable preset edit. Captures the full prior record and restores it on undo;
 * `updatePreset` re-applies the preset to every panel using it, so undo also
 * re-applies the reverted config.
 */
export function makeUpdatePresetCommand(id: Ulid, patch: UpdatePresetInput): Command {
  const presetStore = usePresetStore();
  let prior: UpdatePresetInput | null = null;
  return makeCommand({
    label: "Edit preset",
    scope: "preset",
    category: "update",
    async redo() {
      const db = await getDb();
      const current = await db.get("presets", id);
      if (current) {
        prior = {
          name: current.name,
          description: current.description,
          config: current.config,
          workspaceId: current.workspaceId,
        };
      }
      await presetStore.updatePreset(id, patch);
    },
    async undo() {
      if (prior) await presetStore.updatePreset(id, prior);
    },
  });
}

/** Undoable preset delete (strict — `redo` throws if the preset is in use). */
export function makeDeletePresetCommand(id: Ulid): Command {
  const presetStore = usePresetStore();
  let snapshot: null | Preset = null;
  return makeCommand({
    label: "Delete preset",
    scope: "preset",
    category: "delete",
    async redo() {
      const db = await getDb();
      const preset = await db.get("presets", id);
      if (!preset) throw new Error(`Preset not found: ${id}`);
      snapshot = preset;
      await presetStore.deletePreset(id);
    },
    async undo() {
      if (!snapshot) return;
      const db = await getDb();
      await db.add("presets", snapshot);
      await reloadPresetCache();
    },
  });
}

export function makeDuplicatePresetCommand(
  id: Ulid,
  opts?: { name?: string; workspaceId?: null | Ulid },
): Command {
  const presetStore = usePresetStore();
  let dupId: null | Ulid = null;
  return makeCommand({
    label: "Duplicate preset",
    scope: "preset",
    category: "create",
    async redo() {
      const dup = await presetStore.duplicatePreset(id, opts ?? {});
      dupId = dup.id;
    },
    async undo() {
      if (dupId !== null) await presetStore.deletePreset(dupId, { force: true });
    },
  });
}
