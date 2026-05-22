import type { Layout, PanelState, Ulid } from "@/types/workspace";

import { getDb } from "./db";
import { InvariantError, NotFoundError } from "./errors";
import { newId } from "./ids";

export interface CreateLayoutInput {
  workspaceId: Ulid;
  name: string;
  description?: string;
  dockviewState?: unknown;
  panelIds?: Ulid[];
}

export interface UpdateLayoutInput {
  name?: string;
  description?: string;
  dockviewState?: unknown;
  panelIds?: Ulid[];
}

/**
 * Repository for {@link Layout} records.
 *
 * Invariants enforced here:
 *  - Every layout has a non-empty `workspaceId` pointing at a real workspace
 *    (not verified inside `create` — that's the caller's job; we trust the
 *    seed/UI to pass a valid id).
 *  - At least one layout per workspace; `delete` refuses to remove the last
 *    one for a given workspace.
 *  - `delete` cascades to panel-states.
 *  - `duplicate` deep-clones with fresh ULIDs for the layout and every panel
 *    it contains, then rewrites the `dockviewState` string body so the
 *    Dockview JSON references the new panel ids. The string-replace approach
 *    is good enough for the well-defined panel-id token format ULIDs use;
 *    we'll graduate to a proper Dockview-aware walker if/when a panel id
 *    collides with non-id content.
 */
export const layoutRepo = {
  async create(input: CreateLayoutInput): Promise<Layout> {
    const db = await getDb();
    const now = Date.now();
    const layout: Layout = {
      id: newId(),
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description,
      dockviewState: input.dockviewState ?? null,
      panelIds: input.panelIds ?? [],
      createdAt: now,
      updatedAt: now,
    };
    await db.add("layouts", layout);
    return layout;
  },

  async getById(id: Ulid): Promise<Layout | undefined> {
    const db = await getDb();
    return db.get("layouts", id);
  },

  async listByWorkspace(workspaceId: Ulid): Promise<Layout[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex("layouts", "by-workspace", workspaceId);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },

  async update(id: Ulid, patch: UpdateLayoutInput): Promise<Layout> {
    const db = await getDb();
    const tx = db.transaction("layouts", "readwrite");
    const existing = await tx.store.get(id);
    if (!existing) throw new NotFoundError("Layout", id);
    const updated: Layout = { ...existing, ...patch, updatedAt: Date.now() };
    await tx.store.put(updated);
    await tx.done;
    return updated;
  },

  async delete(id: Ulid): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(["layouts", "panel-states", "workspaces"], "readwrite");
    const existing = await tx.objectStore("layouts").get(id);
    if (!existing) throw new NotFoundError("Layout", id);

    const peers = await tx.objectStore("layouts").index("by-workspace").count(existing.workspaceId);
    if (peers <= 1) {
      throw new InvariantError("Cannot delete the last layout in a workspace");
    }

    const panelIds = await tx.objectStore("panel-states").index("by-layout").getAllKeys(id);
    for (const panelId of panelIds) {
      await tx.objectStore("panel-states").delete(panelId);
    }

    await tx.objectStore("layouts").delete(id);

    const workspace = await tx.objectStore("workspaces").get(existing.workspaceId);
    if (workspace && workspace.defaultLayoutId === id) {
      const remainingLayouts = await tx
        .objectStore("layouts")
        .index("by-workspace")
        .getAll(existing.workspaceId);
      const [promoted] = remainingLayouts.sort((a, b) => a.createdAt - b.createdAt);
      await tx.objectStore("workspaces").put({
        ...workspace,
        defaultLayoutId: promoted ? promoted.id : null,
        updatedAt: Date.now(),
      });
    }

    await tx.done;
  },

  async duplicate(id: Ulid, opts: { name?: string } = {}): Promise<Layout> {
    const db = await getDb();
    const tx = db.transaction(["layouts", "panel-states"], "readwrite");
    const source = await tx.objectStore("layouts").get(id);
    if (!source) throw new NotFoundError("Layout", id);

    const sourcePanels = await tx.objectStore("panel-states").index("by-layout").getAll(id);

    const idMap = new Map<Ulid, Ulid>();
    for (const panel of sourcePanels) {
      idMap.set(panel.id, newId());
    }

    const newLayoutId = newId();
    const now = Date.now();

    let rewrittenDockview = source.dockviewState;
    if (typeof rewrittenDockview === "string") {
      let serialized = rewrittenDockview;
      for (const [oldId, newPanelId] of idMap) {
        serialized = serialized.split(oldId).join(newPanelId);
      }
      rewrittenDockview = serialized;
    } else if (rewrittenDockview && typeof rewrittenDockview === "object") {
      let serialized = JSON.stringify(rewrittenDockview);
      for (const [oldId, newPanelId] of idMap) {
        serialized = serialized.split(oldId).join(newPanelId);
      }
      rewrittenDockview = JSON.parse(serialized);
    }

    const newLayout: Layout = {
      id: newLayoutId,
      workspaceId: source.workspaceId,
      name: opts.name ?? `${source.name} (copy)`,
      description: source.description,
      dockviewState: rewrittenDockview,
      panelIds: source.panelIds.map((pid) => idMap.get(pid) ?? pid),
      createdAt: now,
      updatedAt: now,
    };
    await tx.objectStore("layouts").add(newLayout);

    for (const panel of sourcePanels) {
      const newPanelState: PanelState = {
        ...panel,
        id: idMap.get(panel.id) ?? newId(),
        layoutId: newLayoutId,
        createdAt: now,
        updatedAt: now,
      };
      await tx.objectStore("panel-states").add(newPanelState);
    }

    await tx.done;
    return newLayout;
  },
};
