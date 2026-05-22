import type { PanelAssignmentState, PanelState, PanelType, Ulid } from "@/types/workspace";

import { getDb } from "./db";
import { NotFoundError } from "./errors";
import { newId } from "./ids";

export interface CreatePanelStateInput {
  layoutId: Ulid;
  panelType: null | PanelType;
  assignmentState?: PanelAssignmentState;
  state?: Record<string, unknown>;
  appliedPresetIds?: Ulid[];
  id?: Ulid;
}

export interface UpdatePanelStateInput {
  panelType?: null | PanelType;
  assignmentState?: PanelAssignmentState;
  state?: Record<string, unknown>;
  appliedPresetIds?: Ulid[];
}

/**
 * Repository for {@link PanelState} records.
 *
 * Cascade behavior lives in `layoutRepo.delete` and `workspaceRepo.delete` —
 * this repo doesn't enforce parent existence (the seed and UI pass valid
 * ids; tests verify the cascade end-to-end).
 *
 * Preset application is the load-bearing piece — `appliedPresetIds` is an
 * ordered list and later ids override earlier ones (CSS-cascade semantics).
 * `applyPreset` is idempotent: re-applying an already-applied preset moves
 * it to the end of the list, raising its precedence.
 */
export const panelStateRepo = {
  async create(input: CreatePanelStateInput): Promise<PanelState> {
    const db = await getDb();
    const now = Date.now();
    const panel: PanelState = {
      id: input.id ?? newId(),
      layoutId: input.layoutId,
      panelType: input.panelType,
      assignmentState: input.assignmentState ?? (input.panelType === null ? "empty" : "assigned"),
      state: input.state ?? {},
      appliedPresetIds: input.appliedPresetIds ?? [],
      createdAt: now,
      updatedAt: now,
    };
    await db.add("panel-states", panel);
    return panel;
  },

  async getById(id: Ulid): Promise<PanelState | undefined> {
    const db = await getDb();
    return db.get("panel-states", id);
  },

  async listByLayout(layoutId: Ulid): Promise<PanelState[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex("panel-states", "by-layout", layoutId);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },

  async update(id: Ulid, patch: UpdatePanelStateInput): Promise<PanelState> {
    const db = await getDb();
    const tx = db.transaction("panel-states", "readwrite");
    const existing = await tx.store.get(id);
    if (!existing) throw new NotFoundError("PanelState", id);
    const updated: PanelState = { ...existing, ...patch, updatedAt: Date.now() };
    await tx.store.put(updated);
    await tx.done;
    return updated;
  },

  async delete(id: Ulid): Promise<void> {
    const db = await getDb();
    const tx = db.transaction("panel-states", "readwrite");
    const existing = await tx.store.get(id);
    if (!existing) throw new NotFoundError("PanelState", id);
    await tx.store.delete(id);
    await tx.done;
  },

  async bulkDeleteByLayout(layoutId: Ulid): Promise<void> {
    const db = await getDb();
    const tx = db.transaction("panel-states", "readwrite");
    const ids = await tx.store.index("by-layout").getAllKeys(layoutId);
    for (const id of ids) {
      await tx.store.delete(id);
    }
    await tx.done;
  },

  async applyPreset(panelId: Ulid, presetId: Ulid): Promise<PanelState> {
    const db = await getDb();
    const tx = db.transaction("panel-states", "readwrite");
    const existing = await tx.store.get(panelId);
    if (!existing) throw new NotFoundError("PanelState", panelId);
    const filtered = existing.appliedPresetIds.filter((id) => id !== presetId);
    const updated: PanelState = {
      ...existing,
      appliedPresetIds: [...filtered, presetId],
      updatedAt: Date.now(),
    };
    await tx.store.put(updated);
    await tx.done;
    return updated;
  },

  async removePreset(panelId: Ulid, presetId: Ulid): Promise<PanelState> {
    const db = await getDb();
    const tx = db.transaction("panel-states", "readwrite");
    const existing = await tx.store.get(panelId);
    if (!existing) throw new NotFoundError("PanelState", panelId);
    const updated: PanelState = {
      ...existing,
      appliedPresetIds: existing.appliedPresetIds.filter((id) => id !== presetId),
      updatedAt: Date.now(),
    };
    await tx.store.put(updated);
    await tx.done;
    return updated;
  },
};
