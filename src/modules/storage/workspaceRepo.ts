import type { Ulid, Workspace } from "@/types/workspace";

import { getDb } from "./db";
import { InvariantError, NotFoundError } from "./errors";
import { newId } from "./ids";

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  isGlobalDefault?: boolean;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  defaultLayoutId?: Ulid | null;
}

/**
 * Repository for {@link Workspace} records.
 *
 * Invariants enforced here:
 *  - At most (and, in steady state, exactly) one workspace has
 *    `isGlobalDefault: true`. `setGlobalDefault` atomically swaps the flag.
 *  - At least one workspace always exists; `delete` refuses to remove the
 *    last one.
 *  - `delete` cascades to all layouts owned by the workspace, all
 *    panel-states owned by those layouts, and all workspace-scoped presets.
 */
export const workspaceRepo = {
  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    const db = await getDb();
    const now = Date.now();
    const workspace: Workspace = {
      id: newId(),
      name: input.name,
      description: input.description,
      defaultLayoutId: null,
      isGlobalDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    const tx = db.transaction("workspaces", "readwrite");
    if (input.isGlobalDefault) {
      const all = await tx.store.getAll();
      for (const existing of all) {
        if (existing.isGlobalDefault) {
          await tx.store.put({ ...existing, isGlobalDefault: false, updatedAt: now });
        }
      }
      workspace.isGlobalDefault = true;
    }
    await tx.store.add(workspace);
    await tx.done;
    return workspace;
  },

  async getById(id: Ulid): Promise<Workspace | undefined> {
    const db = await getDb();
    return db.get("workspaces", id);
  },

  async getGlobalDefault(): Promise<undefined | Workspace> {
    const db = await getDb();
    const all = await db.getAll("workspaces");
    return all.find((w) => w.isGlobalDefault);
  },

  async list(): Promise<Workspace[]> {
    const db = await getDb();
    const all = await db.getAll("workspaces");
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },

  async update(id: Ulid, patch: UpdateWorkspaceInput): Promise<Workspace> {
    const db = await getDb();
    const tx = db.transaction("workspaces", "readwrite");
    const existing = await tx.store.get(id);
    if (!existing) throw new NotFoundError("Workspace", id);
    const updated: Workspace = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };
    await tx.store.put(updated);
    await tx.done;
    return updated;
  },

  async setGlobalDefault(id: Ulid): Promise<void> {
    const db = await getDb();
    const tx = db.transaction("workspaces", "readwrite");
    const target = await tx.store.get(id);
    if (!target) throw new NotFoundError("Workspace", id);
    const now = Date.now();
    const all = await tx.store.getAll();
    for (const ws of all) {
      const shouldBeDefault = ws.id === id;
      if (ws.isGlobalDefault !== shouldBeDefault) {
        await tx.store.put({ ...ws, isGlobalDefault: shouldBeDefault, updatedAt: now });
      }
    }
    await tx.done;
  },

  async delete(id: Ulid): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(["workspaces", "layouts", "panel-states", "presets"], "readwrite");

    const target = await tx.objectStore("workspaces").get(id);
    if (!target) throw new NotFoundError("Workspace", id);

    const remaining = await tx.objectStore("workspaces").count();
    if (remaining <= 1) {
      throw new InvariantError("Cannot delete the last workspace");
    }

    const layouts = await tx.objectStore("layouts").index("by-workspace").getAll(id);
    for (const layout of layouts) {
      const panelStates = await tx
        .objectStore("panel-states")
        .index("by-layout")
        .getAllKeys(layout.id);
      for (const panelId of panelStates) {
        await tx.objectStore("panel-states").delete(panelId);
      }
      await tx.objectStore("layouts").delete(layout.id);
    }

    const presets = await tx.objectStore("presets").index("by-workspace").getAll(id);
    for (const preset of presets) {
      await tx.objectStore("presets").delete(preset.id);
    }

    await tx.objectStore("workspaces").delete(id);

    if (target.isGlobalDefault) {
      const survivors = await tx.objectStore("workspaces").getAll();
      const [promoted] = survivors;
      if (promoted) {
        await tx
          .objectStore("workspaces")
          .put({ ...promoted, isGlobalDefault: true, updatedAt: Date.now() });
      }
    }

    await tx.done;
  },
};
