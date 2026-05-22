import { beforeEach, describe, expect, it } from "vitest";

import { chromeProfileRepo } from "@/modules/storage/chromeProfileRepo";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { presetRepo } from "@/modules/storage/presetRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import {
  exportWorkspace,
  importWorkspace,
  type PortableWorkspace,
  PORTABLE_SCHEMA_VERSION,
} from "@/modules/workspaces/portable";

import { resetStorage } from "../storage/helpers";

async function seedRichWorkspace() {
  const ws = await workspaceRepo.create({ name: "Operations", isGlobalDefault: true });
  const layout = await layoutRepo.create({
    workspaceId: ws.id,
    name: "Default",
    dockviewState: { grid: { fake: true } },
  });
  const p1 = await panelStateRepo.create({ layoutId: layout.id, panelType: "cesium" });
  const p2 = await panelStateRepo.create({
    layoutId: layout.id,
    panelType: "maplibre",
    state: { center: [70, 30], zoom: 4 },
  });
  await layoutRepo.update(layout.id, {
    panelIds: [p1.id, p2.id],
    dockviewState: { grid: { fake: true }, panels: { [p1.id]: {}, [p2.id]: {} } },
  });
  await workspaceRepo.update(ws.id, { defaultLayoutId: layout.id });

  const scopedPreset = await presetRepo.create({
    presetTypeId: "map-style",
    workspaceId: ws.id,
    name: "Liberty",
    config: { styleUrl: "https://example/liberty.json" },
  });
  await panelStateRepo.applyPreset(p2.id, scopedPreset.id);

  await chromeProfileRepo.create({
    name: "Default",
    isDefault: true,
    slotAssignments: {
      "top-left": ["app-icon"],
      "top-center": [],
      "top-right": [],
      "status-left": [],
      "status-center": [],
      "status-right": ["clock"],
    },
  });

  return { ws, layout, p1, p2, scopedPreset };
}

describe("portable workspace export/import", () => {
  beforeEach(async () => {
    await resetStorage();
  });

  it("export captures workspace + layouts + panel-states + scoped presets", async () => {
    const { ws, layout, p1, p2, scopedPreset } = await seedRichWorkspace();
    const payload = await exportWorkspace(ws.id);

    expect(payload.schemaVersion).toBe(PORTABLE_SCHEMA_VERSION);
    expect(payload.exportedBy).toBe("commandvue");
    expect(payload.workspace.id).toBe(ws.id);
    expect(payload.layouts.map((l) => l.id)).toEqual([layout.id]);
    expect(payload.panelStates.map((p) => p.id).sort()).toEqual([p1.id, p2.id].sort());
    expect(payload.presets.map((p) => p.id)).toEqual([scopedPreset.id]);
    expect(payload.chromeProfile).toBeUndefined();
  });

  it("export with includeChrome embeds the default chrome profile", async () => {
    const { ws } = await seedRichWorkspace();
    const payload = await exportWorkspace(ws.id, { includeChrome: true });
    expect(payload.chromeProfile?.name).toBe("Default");
    expect(payload.chromeProfile?.slotAssignments["status-right"]).toEqual(["clock"]);
  });

  it("import regenerates every ULID and isolates from source", async () => {
    const { ws } = await seedRichWorkspace();
    const payload = await exportWorkspace(ws.id);
    const sourceIds = new Set<string>([
      payload.workspace.id,
      ...payload.layouts.map((l) => l.id),
      ...payload.panelStates.map((p) => p.id),
      ...payload.presets.map((p) => p.id),
    ]);

    const imported = await importWorkspace(payload);
    expect(sourceIds.has(imported.id)).toBe(false);

    const importedLayouts = await layoutRepo.listByWorkspace(imported.id);
    for (const layout of importedLayouts) expect(sourceIds.has(layout.id)).toBe(false);

    const allPanels = await Promise.all(
      importedLayouts.map((l) => panelStateRepo.listByLayout(l.id)),
    );
    for (const panel of allPanels.flat()) expect(sourceIds.has(panel.id)).toBe(false);

    const importedPresets = await presetRepo.listForWorkspace(imported.id);
    for (const preset of importedPresets) expect(sourceIds.has(preset.id)).toBe(false);
  });

  it("import rewrites panel-id refs inside dockviewState", async () => {
    const { ws } = await seedRichWorkspace();
    const payload = await exportWorkspace(ws.id);
    const sourcePanelIds = payload.panelStates.map((p) => p.id);

    const imported = await importWorkspace(payload);
    const importedLayouts = await layoutRepo.listByWorkspace(imported.id);
    const dockviewState = importedLayouts[0]!.dockviewState as {
      panels: Record<string, unknown>;
    } | null;
    expect(dockviewState).not.toBeNull();
    for (const oldId of sourcePanelIds) {
      expect(JSON.stringify(dockviewState)).not.toContain(oldId);
    }
  });

  it("import rewrites preset refs inside panel-states", async () => {
    const { ws, p2, scopedPreset } = await seedRichWorkspace();
    const payload = await exportWorkspace(ws.id);
    const imported = await importWorkspace(payload);

    const importedLayouts = await layoutRepo.listByWorkspace(imported.id);
    const importedPanels = await panelStateRepo.listByLayout(importedLayouts[0]!.id);
    const importedPresets = await presetRepo.listForWorkspace(imported.id);

    const refPanel = importedPanels.find((p) => p.panelType === "maplibre");
    expect(refPanel).toBeDefined();
    expect(refPanel!.appliedPresetIds).toHaveLength(1);
    expect(refPanel!.appliedPresetIds[0]).not.toBe(scopedPreset.id);
    expect(refPanel!.appliedPresetIds[0]).toBe(importedPresets[0]!.id);
    void p2;
  });

  it("import renames on conflict by default", async () => {
    const { ws } = await seedRichWorkspace();
    const payload = await exportWorkspace(ws.id);
    const a = await importWorkspace(payload);
    const b = await importWorkspace(payload);
    expect(a.name).toBe("Operations (2)");
    expect(b.name).toBe("Operations (3)");
  });

  it("import refuses unknown schemaVersion", async () => {
    const fake = { schemaVersion: 99, exportedBy: "commandvue" } as unknown as PortableWorkspace;
    await expect(importWorkspace(fake)).rejects.toThrow(/Unsupported portable workspace schema/);
  });

  it("import refuses payloads from other tools", async () => {
    const fake = {
      schemaVersion: PORTABLE_SCHEMA_VERSION,
      exportedBy: "other-tool",
    } as unknown as PortableWorkspace;
    await expect(importWorkspace(fake)).rejects.toThrow(/Not a CommandVue workspace export/);
  });

  it("imported workspace is NOT global default", async () => {
    const { ws } = await seedRichWorkspace();
    const payload = await exportWorkspace(ws.id);
    const imported = await importWorkspace(payload);
    expect(imported.isGlobalDefault).toBe(false);
  });

  it("import with importChrome creates a non-default chrome profile copy", async () => {
    const { ws } = await seedRichWorkspace();
    const payload = await exportWorkspace(ws.id, { includeChrome: true });
    const before = (await chromeProfileRepo.list()).length;
    await importWorkspace(payload, { renameOnConflict: true, importChrome: true });
    const after = await chromeProfileRepo.list();
    expect(after.length).toBe(before + 1);
    const imported = after.find((p) => p.name === "Default (imported)");
    expect(imported).toBeDefined();
    expect(imported?.isDefault).toBe(false);
  });
});
