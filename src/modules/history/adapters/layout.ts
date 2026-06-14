import type { Command } from "../types";
import type { Layout, PanelState, Ulid } from "@/types/workspace";

import { getDb } from "@/modules/storage/db";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import { useLayoutStore } from "@/stores/layout";
import { useWorkspaceStore } from "@/stores/workspace";

import { makeCommand } from "../factories";

/** Re-sync the layout store's `shallowRef` list for the active workspace. */
async function reloadLayouts(): Promise<void> {
  const wsId = useWorkspaceStore().currentWorkspaceId;
  if (wsId) await useLayoutStore().loadForWorkspace(wsId);
}

export function makeRenameLayoutCommand(id: Ulid, nextName: string): Command {
  const layoutStore = useLayoutStore();
  let priorName: null | string = null;
  return makeCommand({
    label: "Rename layout",
    scope: "layout",
    category: "update",
    async redo() {
      const db = await getDb();
      priorName = (await db.get("layouts", id))?.name ?? null;
      await layoutStore.renameLayout(id, { name: nextName });
    },
    async undo() {
      if (priorName !== null) await layoutStore.renameLayout(id, { name: priorName });
    },
  });
}

interface LayoutDeleteSnapshot {
  layout: Layout;
  panelStates: PanelState[];
  workspaceId: Ulid;
  priorDefaultLayoutId: null | Ulid;
}

/**
 * Undoable layout delete. `redo` snapshots the layout + its panel-states + the
 * parent workspace's default pointer (the repo may auto-promote another layout
 * to default), then deletes. `undo` re-inserts everything by id and restores
 * the default pointer.
 */
export function makeDeleteLayoutCommand(layoutId: Ulid): Command {
  const layoutStore = useLayoutStore();
  let snap: LayoutDeleteSnapshot | null = null;
  return makeCommand({
    label: "Delete layout",
    scope: "layout",
    category: "delete",
    async redo() {
      const db = await getDb();
      const layout = await db.get("layouts", layoutId);
      if (!layout) throw new Error(`Layout not found: ${layoutId}`);
      const panelStates = await db.getAllFromIndex("panel-states", "by-layout", layoutId);
      const workspace = await db.get("workspaces", layout.workspaceId);
      snap = {
        layout,
        panelStates,
        workspaceId: layout.workspaceId,
        priorDefaultLayoutId: workspace?.defaultLayoutId ?? null,
      };
      await layoutStore.deleteLayout(layoutId);
    },
    async undo() {
      if (!snap) return;
      const db = await getDb();
      await db.add("layouts", snap.layout);
      for (const ps of snap.panelStates) await db.add("panel-states", ps);
      await workspaceRepo.update(snap.workspaceId, { defaultLayoutId: snap.priorDefaultLayoutId });
      await reloadLayouts();
    },
  });
}

/** Undoable layout duplicate. `undo` deletes the duplicate (cascading its panels). */
export function makeDuplicateLayoutCommand(id: Ulid, opts?: { name?: string }): Command {
  const layoutStore = useLayoutStore();
  let dupId: null | Ulid = null;
  return makeCommand({
    label: "Duplicate layout",
    scope: "layout",
    category: "create",
    async redo() {
      const dup = await layoutStore.duplicateLayout(id, opts ?? {});
      dupId = dup.id;
    },
    async undo() {
      if (dupId !== null) await layoutStore.deleteLayout(dupId);
    },
  });
}

export function makeSetDefaultLayoutCommand(workspaceId: Ulid, layoutId: Ulid): Command {
  const layoutStore = useLayoutStore();
  let priorDefault: null | Ulid = null;
  return makeCommand({
    label: "Set default layout",
    scope: "layout",
    category: "update",
    async redo() {
      const db = await getDb();
      priorDefault = (await db.get("workspaces", workspaceId))?.defaultLayoutId ?? null;
      await layoutStore.setDefaultForWorkspace(workspaceId, layoutId);
    },
    async undo() {
      await workspaceRepo.update(workspaceId, { defaultLayoutId: priorDefault });
      await useWorkspaceStore().refreshAll();
    },
  });
}
