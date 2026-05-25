import type { ChromeItemId, ChromeSlot } from "@/types/chrome";

import { chromeProfileRepo } from "./chromeProfileRepo";
import { layoutRepo } from "./layoutRepo";
import { panelStateRepo } from "./panelStateRepo";
import { workspaceRepo } from "./workspaceRepo";

/**
 * First-run seed. Creates one workspace ("Operations" — global default) with
 * one layout ("Default") containing the seven built-in panels, plus the
 * default chrome profile with the slot assignments described in the Phase A
 * spec.
 *
 * Idempotent: if any workspace already exists, the function returns without
 * touching state. Called from `main.ts` before `app.mount()`.
 *
 * The seven panels are seeded in `assignmentState: 'configured'` so the
 * first-launch UX matches the demo dock that shipped before the workspace
 * system landed. `dockviewState` is left null on the seed layout — the
 * existing `DockLayout.vue` already knows how to build the demo arrangement
 * from a panel-id list; Phase C wires the persistence path that will
 * populate `dockviewState` thereafter.
 */
export const SEED_PANEL_TYPES = [
  "cesium",
  "maplibre",
  "entities",
  "chart",
  "telemetry",
  "markdown",
  "symbology",
] as const;

export const DEFAULT_CHROME_SLOT_ASSIGNMENTS: Record<ChromeSlot, ChromeItemId[]> = {
  "top-left": ["app-icon", "menu-bar"],
  "top-center": [],
  "top-right": ["theme-toggle", "workspace-switcher"],
  "status-left": ["current-workspace-label", "current-layout-label", "dirty-indicator"],
  "status-center": [],
  "status-right": ["websocket-status", "clock", "edit-mode-toggle"],
};

export async function seedIfEmpty(): Promise<void> {
  const existing = await workspaceRepo.list();
  if (existing.length > 0) return;

  const workspace = await workspaceRepo.create({
    name: "Operations",
    description: "Default workspace seeded on first launch.",
    isGlobalDefault: true,
  });

  const layout = await layoutRepo.create({
    workspaceId: workspace.id,
    name: "Default",
    description: "Default seven-panel arrangement.",
  });

  const panelIds: string[] = [];
  for (const panelType of SEED_PANEL_TYPES) {
    const panel = await panelStateRepo.create({
      layoutId: layout.id,
      panelType,
      assignmentState: "configured",
    });
    panelIds.push(panel.id);
  }

  await layoutRepo.update(layout.id, { panelIds });
  await workspaceRepo.update(workspace.id, { defaultLayoutId: layout.id });

  const profiles = await chromeProfileRepo.list();
  if (profiles.length === 0) {
    await chromeProfileRepo.create({
      name: "Default",
      isDefault: true,
      slotAssignments: DEFAULT_CHROME_SLOT_ASSIGNMENTS,
      menuBarVisible: true,
      statusBarVisible: true,
    });
  }
}
