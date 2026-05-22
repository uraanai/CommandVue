import type { Preset, PresetTypeId } from "@/types/preset";
import type { Ulid } from "@/types/workspace";

import { getDb } from "./db";
import { ConflictError, NotFoundError } from "./errors";
import { newId } from "./ids";

export interface CreatePresetInput {
  presetTypeId: PresetTypeId;
  workspaceId: null | Ulid;
  name: string;
  description?: string;
  config: Record<string, unknown>;
}

export interface UpdatePresetInput {
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
  workspaceId?: null | Ulid;
}

export interface ListPresetsFilter {
  workspaceId?: null | Ulid;
  presetTypeId?: PresetTypeId;
}

/**
 * Repository for {@link Preset} records.
 *
 * Global vs scoped: a preset with `workspaceId: null` is global and survives
 * all workspace deletes. A preset with a workspace id cascade-deletes with
 * its workspace (handled in `workspaceRepo.delete`).
 *
 * `delete` is strict by default — it scans every panel-state for references
 * and throws `ConflictError` if any are still using the preset. Callers that
 * want the lenient behavior (silently strip references) should pass
 * `{ force: true }`. The presets-can-go-stale behavior described in invariant
 * 9 is implemented in the preset apply path, not here.
 */
export const presetRepo = {
  async create(input: CreatePresetInput): Promise<Preset> {
    const db = await getDb();
    const now = Date.now();
    const preset: Preset = {
      id: newId(),
      presetTypeId: input.presetTypeId,
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description,
      config: input.config,
      createdAt: now,
      updatedAt: now,
    };
    await db.add("presets", preset);
    return preset;
  },

  async getById(id: Ulid): Promise<Preset | undefined> {
    const db = await getDb();
    return db.get("presets", id);
  },

  async list(filter: ListPresetsFilter = {}): Promise<Preset[]> {
    const db = await getDb();
    let result: Preset[];
    if (filter.workspaceId !== undefined) {
      if (filter.workspaceId === null) {
        const all = await db.getAll("presets");
        result = all.filter((p) => p.workspaceId === null);
      } else {
        result = await db.getAllFromIndex("presets", "by-workspace", filter.workspaceId);
      }
    } else if (filter.presetTypeId !== undefined) {
      result = await db.getAllFromIndex("presets", "by-presetType", filter.presetTypeId);
    } else {
      result = await db.getAll("presets");
    }
    if (filter.presetTypeId !== undefined) {
      result = result.filter((p) => p.presetTypeId === filter.presetTypeId);
    }
    return result.sort((a, b) => a.createdAt - b.createdAt);
  },

  listGlobal(): Promise<Preset[]> {
    return presetRepo.list({ workspaceId: null });
  },

  listForWorkspace(workspaceId: Ulid): Promise<Preset[]> {
    return presetRepo.list({ workspaceId });
  },

  async update(id: Ulid, patch: UpdatePresetInput): Promise<Preset> {
    const db = await getDb();
    const tx = db.transaction("presets", "readwrite");
    const existing = await tx.store.get(id);
    if (!existing) throw new NotFoundError("Preset", id);
    const updated: Preset = { ...existing, ...patch, updatedAt: Date.now() };
    await tx.store.put(updated);
    await tx.done;
    return updated;
  },

  async delete(id: Ulid, opts: { force?: boolean } = {}): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(["presets", "panel-states"], "readwrite");
    const existing = await tx.objectStore("presets").get(id);
    if (!existing) throw new NotFoundError("Preset", id);

    const allPanels = await tx.objectStore("panel-states").getAll();
    const referencing = allPanels.filter((p) => p.appliedPresetIds.includes(id));

    if (referencing.length > 0 && !opts.force) {
      throw new ConflictError(
        `Preset is in use by ${referencing.length} panel${referencing.length === 1 ? "" : "s"}`,
      );
    }

    if (opts.force) {
      const now = Date.now();
      for (const panel of referencing) {
        await tx.objectStore("panel-states").put({
          ...panel,
          appliedPresetIds: panel.appliedPresetIds.filter((pid) => pid !== id),
          updatedAt: now,
        });
      }
    }

    await tx.objectStore("presets").delete(id);
    await tx.done;
  },

  async duplicate(
    id: Ulid,
    opts: { name?: string; workspaceId?: null | Ulid } = {},
  ): Promise<Preset> {
    const db = await getDb();
    const source = await db.get("presets", id);
    if (!source) throw new NotFoundError("Preset", id);
    return presetRepo.create({
      presetTypeId: source.presetTypeId,
      workspaceId: opts.workspaceId !== undefined ? opts.workspaceId : source.workspaceId,
      name: opts.name ?? `${source.name} (copy)`,
      description: source.description,
      config: structuredClone(source.config),
    });
  },
};
