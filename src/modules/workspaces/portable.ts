import type { ChromeProfile } from "@/types/chrome";
import type { Preset } from "@/types/preset";
import type { Layout, PanelState, Ulid, Workspace } from "@/types/workspace";

import { chromeProfileRepo } from "@/modules/storage/chromeProfileRepo";
import { newId } from "@/modules/storage/ids";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { presetRepo } from "@/modules/storage/presetRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";

/**
 * Portable workspace export shape.
 *
 * Versioned via `schemaVersion` so older / newer payloads can be detected at
 * import time. **Bump the version** whenever the shape of any constituent
 * record changes; older versions then surface a "unsupported export" error
 * rather than silently corrupting state.
 *
 * The export deliberately does NOT include the global preset library —
 * those are user-global (or, post-Supabase, org-/system-global) and live
 * outside the workspace boundary. Only **workspace-scoped** presets travel
 * with the workspace.
 */
export const PORTABLE_SCHEMA_VERSION = 2 as const;

export interface PortableWorkspace {
  schemaVersion: typeof PORTABLE_SCHEMA_VERSION;
  workspace: Workspace;
  layouts: Layout[];
  panelStates: PanelState[];
  presets: Preset[];
  chromeProfile?: ChromeProfile;
  exportedAt: number;
  exportedBy: "commandvue";
}

export interface ExportOptions {
  includeChrome: boolean;
}

export interface ImportOptions {
  /** When true, rename the workspace if its name collides with an existing one. */
  renameOnConflict: boolean;
  /** When true, also import the embedded chrome profile (if present). */
  importChrome: boolean;
}

export async function exportWorkspace(
  workspaceId: Ulid,
  opts: ExportOptions = { includeChrome: false },
): Promise<PortableWorkspace> {
  const workspace = await workspaceRepo.getById(workspaceId);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);

  const layouts = await layoutRepo.listByWorkspace(workspaceId);
  const panelStates: PanelState[] = [];
  for (const layout of layouts) {
    const states = await panelStateRepo.listByLayout(layout.id);
    panelStates.push(...states);
  }
  const presets = await presetRepo.listForWorkspace(workspaceId);

  let chromeProfile: ChromeProfile | undefined;
  if (opts.includeChrome) {
    chromeProfile = await chromeProfileRepo.getDefault();
  }

  return {
    schemaVersion: PORTABLE_SCHEMA_VERSION,
    workspace,
    layouts,
    panelStates,
    presets,
    ...(chromeProfile ? { chromeProfile } : {}),
    exportedAt: Date.now(),
    exportedBy: "commandvue",
  };
}

export async function importWorkspace(
  data: PortableWorkspace,
  opts: ImportOptions = { renameOnConflict: true, importChrome: false },
): Promise<Workspace> {
  if (data.exportedBy !== "commandvue") {
    throw new Error("Not a CommandVue workspace export");
  }
  if (data.schemaVersion !== PORTABLE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported portable workspace schema: got ${data.schemaVersion}, expected ${PORTABLE_SCHEMA_VERSION}`,
    );
  }

  // 1. Build id-translation tables. We regenerate every ULID so the imported
  //    workspace is fully isolated from the source.
  const layoutIdMap = new Map<Ulid, Ulid>();
  for (const layout of data.layouts) layoutIdMap.set(layout.id, newId());
  const panelIdMap = new Map<Ulid, Ulid>();
  for (const panel of data.panelStates) panelIdMap.set(panel.id, newId());
  const presetIdMap = new Map<Ulid, Ulid>();
  for (const preset of data.presets) presetIdMap.set(preset.id, newId());

  // 2. Resolve the workspace name (rename on conflict if asked).
  let workspaceName = data.workspace.name;
  if (opts.renameOnConflict) {
    const existing = await workspaceRepo.list();
    const taken = new Set(existing.map((w) => w.name));
    let suffix = 1;
    let candidate = workspaceName;
    while (taken.has(candidate)) {
      suffix += 1;
      candidate = `${workspaceName} (${suffix})`;
    }
    workspaceName = candidate;
  }

  // 3. Create the workspace (never as global default).
  const newWorkspace = await workspaceRepo.create({
    name: workspaceName,
    description: data.workspace.description,
    isGlobalDefault: false,
  });

  // 4. Create the presets first so we can rewrite preset refs in panel-states.
  for (const preset of data.presets) {
    const newPresetId = presetIdMap.get(preset.id)!;
    const created = await presetRepo.create({
      presetTypeId: preset.presetTypeId,
      workspaceId: newWorkspace.id,
      name: preset.name,
      description: preset.description,
      config: structuredClone(preset.config),
    });
    // The repo assigned its own id; rewrite the map entry to the actual one.
    presetIdMap.set(preset.id, created.id);
    void newPresetId;
  }

  // 5. Create layouts (with rewritten dockviewState referencing new panel ids).
  for (const layout of data.layouts) {
    const newLayoutId = layoutIdMap.get(layout.id)!;
    let rewrittenDockview = layout.dockviewState;
    if (rewrittenDockview && typeof rewrittenDockview === "object") {
      let serialized = JSON.stringify(rewrittenDockview);
      for (const [oldId, newId] of panelIdMap) serialized = serialized.split(oldId).join(newId);
      rewrittenDockview = JSON.parse(serialized);
    } else if (typeof rewrittenDockview === "string") {
      let serialized = rewrittenDockview;
      for (const [oldId, newId] of panelIdMap) serialized = serialized.split(oldId).join(newId);
      rewrittenDockview = serialized;
    }

    const newPanelIds = layout.panelIds.map((id) => panelIdMap.get(id) ?? id);

    await layoutRepo.create({
      workspaceId: newWorkspace.id,
      name: layout.name,
      description: layout.description,
      dockviewState: rewrittenDockview,
      panelIds: newPanelIds,
    });

    // We just created a layout; the repo assigned a fresh id, NOT our
    // `newLayoutId`. Re-read so we can rewrite panel-states to point at the
    // correct id.
    const created = (await layoutRepo.listByWorkspace(newWorkspace.id)).find(
      (l) => l.name === layout.name && l.createdAt >= newWorkspace.createdAt,
    );
    if (created) {
      layoutIdMap.set(layout.id, created.id);
    } else {
      layoutIdMap.set(layout.id, newLayoutId);
    }
  }

  // 6. Create the panel-states.
  for (const panel of data.panelStates) {
    const newPanelId = panelIdMap.get(panel.id)!;
    const newLayoutId = layoutIdMap.get(panel.layoutId);
    if (!newLayoutId) continue;
    // Rewrite preset references (drop unknown ones silently — invariant 9).
    const remappedPresetIds: Ulid[] = [];
    for (const oldPresetId of panel.appliedPresetIds) {
      const remapped = presetIdMap.get(oldPresetId);
      if (remapped) remappedPresetIds.push(remapped);
    }
    await panelStateRepo.create({
      id: newPanelId,
      layoutId: newLayoutId,
      panelType: panel.panelType,
      assignmentState: panel.assignmentState,
      state: structuredClone(panel.state),
      appliedPresetIds: remappedPresetIds,
    });
  }

  // 7. Repoint workspace.defaultLayoutId to the new layout id.
  const newDefaultLayoutId = data.workspace.defaultLayoutId
    ? layoutIdMap.get(data.workspace.defaultLayoutId)
    : null;
  if (newDefaultLayoutId) {
    await workspaceRepo.update(newWorkspace.id, { defaultLayoutId: newDefaultLayoutId });
  } else {
    // Workspace has no explicit default — fall back to the first created layout.
    const firstLayout = (await layoutRepo.listByWorkspace(newWorkspace.id))[0];
    if (firstLayout) {
      await workspaceRepo.update(newWorkspace.id, { defaultLayoutId: firstLayout.id });
    }
  }

  // 8. Optionally import the chrome profile.
  if (opts.importChrome && data.chromeProfile) {
    await chromeProfileRepo.create({
      name: `${data.chromeProfile.name} (imported)`,
      isDefault: false,
      slotAssignments: data.chromeProfile.slotAssignments,
      hiddenItems: data.chromeProfile.hiddenItems,
      menuBarVisible: data.chromeProfile.menuBarVisible,
      statusBarVisible: data.chromeProfile.statusBarVisible,
    });
  }

  const refreshed = await workspaceRepo.getById(newWorkspace.id);
  return refreshed ?? newWorkspace;
}
