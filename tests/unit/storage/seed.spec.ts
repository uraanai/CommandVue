import { beforeEach, describe, expect, it } from "vitest";

import { chromeProfileRepo } from "@/modules/storage/chromeProfileRepo";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import {
  DEFAULT_CHROME_SLOT_ASSIGNMENTS,
  SEED_PANEL_TYPES,
  seedIfEmpty,
} from "@/modules/storage/seed";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";

import { resetStorage } from "./helpers";

describe("seedIfEmpty", () => {
  beforeEach(async () => {
    await resetStorage();
  });

  it("creates the Operations workspace, Default layout, seven panels, and Default chrome profile on first run", async () => {
    await seedIfEmpty();

    const workspaces = await workspaceRepo.list();
    expect(workspaces).toHaveLength(1);
    const ws = workspaces[0]!;
    expect(ws.name).toBe("Operations");
    expect(ws.isGlobalDefault).toBe(true);
    expect(ws.defaultLayoutId).not.toBeNull();

    const layouts = await layoutRepo.listByWorkspace(ws.id);
    expect(layouts).toHaveLength(1);
    const layout = layouts[0]!;
    expect(layout.name).toBe("Default");
    expect(layout.id).toBe(ws.defaultLayoutId);

    const panels = await panelStateRepo.listByLayout(layout.id);
    expect(panels).toHaveLength(SEED_PANEL_TYPES.length);
    const seededTypes = panels.map((p) => p.panelType).sort();
    expect(seededTypes).toEqual([...SEED_PANEL_TYPES].sort());
    for (const panel of panels) {
      expect(panel.assignmentState).toBe("configured");
    }

    const profile = await chromeProfileRepo.getDefault();
    expect(profile?.name).toBe("Default");
    expect(profile?.slotAssignments).toEqual(DEFAULT_CHROME_SLOT_ASSIGNMENTS);
    expect(profile?.menuBarVisible).toBe(true);
    expect(profile?.statusBarVisible).toBe(true);
  });

  it("is idempotent — a second call after seed does not duplicate state", async () => {
    await seedIfEmpty();
    const beforeWorkspaces = (await workspaceRepo.list()).length;
    const beforeProfiles = (await chromeProfileRepo.list()).length;

    await seedIfEmpty();

    expect((await workspaceRepo.list()).length).toBe(beforeWorkspaces);
    expect((await chromeProfileRepo.list()).length).toBe(beforeProfiles);
  });
});
