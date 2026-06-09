import type { Command } from "../types";
import type { Preset } from "@/types/preset";
import type { Layout, PanelState, Ulid, Workspace } from "@/types/workspace";

import { appMetaRepo } from "@/modules/storage/appMetaRepo";
import { getDb } from "@/modules/storage/db";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import { useLayoutStore } from "@/stores/layout";
import { usePresetStore } from "@/stores/preset";
import { useWorkspaceStore } from "@/stores/workspace";

import { makeCommand } from "../factories";

/** app-meta key prefix for a workspace's bound theme (mirrors theme.ts). */
const WORKSPACE_THEME_KEY_PREFIX = "commandvue:workspace-theme-";

interface WorkspaceCascadeSnapshot {
  workspace: Workspace;
  layouts: Layout[];
  panelStates: PanelState[];
  presets: Preset[];
  /** Bound theme id from app-meta (null when unbound). */
  themeId: null | string;
}

/**
 * Snapshot a workspace plus everything `workspaceRepo.delete` cascades (child
 * layouts, their panel-states, workspace-scoped presets) AND the theme binding
 * the repo leaves dangling in app-meta. Structural only — no business logic.
 */
async function captureWorkspaceCascade(workspaceId: Ulid): Promise<WorkspaceCascadeSnapshot> {
  const db = await getDb();
  const workspace = await db.get("workspaces", workspaceId);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);
  const layouts = await db.getAllFromIndex("layouts", "by-workspace", workspaceId);
  const panelStates: PanelState[] = [];
  for (const layout of layouts) {
    panelStates.push(...(await db.getAllFromIndex("panel-states", "by-layout", layout.id)));
  }
  const presets = await db.getAllFromIndex("presets", "by-workspace", workspaceId);
  const themeId =
    (await appMetaRepo.get<string>(`${WORKSPACE_THEME_KEY_PREFIX}${workspaceId}`)) ?? null;
  return { workspace, layouts, panelStates, presets, themeId };
}

/** Re-insert a captured cascade by original id (raw — preserves ids + timestamps). */
async function restoreWorkspaceCascade(snap: WorkspaceCascadeSnapshot): Promise<void> {
  const db = await getDb();
  await db.add("workspaces", snap.workspace);
  for (const layout of snap.layouts) await db.add("layouts", layout);
  for (const ps of snap.panelStates) await db.add("panel-states", ps);
  for (const preset of snap.presets) await db.add("presets", preset);
  if (snap.themeId !== null) {
    await appMetaRepo.set(`${WORKSPACE_THEME_KEY_PREFIX}${snap.workspace.id}`, snap.themeId);
  }
  // The repo auto-promotes a survivor to global-default on delete. If the
  // deleted workspace WAS the default, re-affirm it so there's exactly one
  // again (setGlobalDefault atomically clears the survivor's flag).
  if (snap.workspace.isGlobalDefault) {
    await workspaceRepo.setGlobalDefault(snap.workspace.id);
  }
}

async function reloadActiveWorkspaceCaches(): Promise<void> {
  const ws = useWorkspaceStore();
  await ws.loadAll();
  const active = ws.currentWorkspaceId;
  if (active) {
    await useLayoutStore().loadForWorkspace(active);
    await usePresetStore().loadForWorkspace(active);
  }
}

/**
 * Undoable cascading workspace delete. `redo` snapshots the full cascade, runs
 * the real `deleteWorkspace`, and also clears the theme binding the repo leaves
 * dangling. `undo` re-inserts every captured record by its original id and
 * re-syncs the reactive stores — all as a single undo step.
 */
export function makeDeleteWorkspaceCommand(workspaceId: Ulid): Command {
  const ws = useWorkspaceStore();
  let snapshot: WorkspaceCascadeSnapshot | null = null;
  return makeCommand({
    label: "Delete workspace",
    scope: "workspace",
    category: "delete",
    async redo() {
      snapshot = await captureWorkspaceCascade(workspaceId);
      await ws.deleteWorkspace(workspaceId);
      await appMetaRepo.delete(`${WORKSPACE_THEME_KEY_PREFIX}${workspaceId}`);
    },
    async undo() {
      if (!snapshot) return;
      await restoreWorkspaceCascade(snapshot);
      await reloadActiveWorkspaceCaches();
    },
  });
}

/**
 * Undoable workspace create — the compound the Manage dialog performs (a
 * workspace plus its mandatory first layout). `undo` deletes the workspace,
 * which cascades the layout away.
 */
export function makeCreateWorkspaceCommand(name: string): Command {
  const ws = useWorkspaceStore();
  let createdId: null | Ulid = null;
  return makeCommand({
    label: "Create workspace",
    scope: "workspace",
    category: "create",
    async redo() {
      const created = await ws.createWorkspace({ name });
      createdId = created.id;
      await layoutRepo.create({ workspaceId: created.id, name: "Default" });
    },
    async undo() {
      if (createdId === null) return;
      await ws.deleteWorkspace(createdId);
      await appMetaRepo.delete(`${WORKSPACE_THEME_KEY_PREFIX}${createdId}`);
    },
  });
}

export function makeRenameWorkspaceCommand(id: Ulid, nextName: string): Command {
  const ws = useWorkspaceStore();
  let priorName: null | string = null;
  return makeCommand({
    label: "Rename workspace",
    scope: "workspace",
    category: "update",
    async redo() {
      const db = await getDb();
      priorName = (await db.get("workspaces", id))?.name ?? null;
      await ws.renameWorkspace(id, { name: nextName });
    },
    async undo() {
      if (priorName !== null) await ws.renameWorkspace(id, { name: priorName });
    },
  });
}

export function makeSetGlobalDefaultWorkspaceCommand(id: Ulid): Command {
  const ws = useWorkspaceStore();
  let priorDefaultId: null | Ulid = null;
  return makeCommand({
    label: "Set default workspace",
    scope: "workspace",
    category: "update",
    async redo() {
      const db = await getDb();
      priorDefaultId = (await db.getAll("workspaces")).find((w) => w.isGlobalDefault)?.id ?? null;
      await ws.setGlobalDefault(id);
    },
    async undo() {
      if (priorDefaultId !== null) await ws.setGlobalDefault(priorDefaultId);
    },
  });
}
