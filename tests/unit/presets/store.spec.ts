import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __unregisterBuiltinPresetTypesForTests,
  registerBuiltinPresetTypes,
} from "@/modules/presets/builtin";
import { presetTypeRegistry } from "@/modules/presets/registry";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { panelStateRepo } from "@/modules/storage/panelStateRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import { usePanelStateStore } from "@/stores/panelState";
import { usePresetStore } from "@/stores/preset";

import { resetForStoreTest } from "../stores/helpers";

async function seed() {
  const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
  const layout = await layoutRepo.create({ workspaceId: ws.id, name: "L" });
  return { ws, layout };
}

describe("usePresetStore", () => {
  beforeEach(async () => {
    await resetForStoreTest();
    __unregisterBuiltinPresetTypesForTests();
    registerBuiltinPresetTypes();
  });

  it("loadForWorkspace returns global + workspace-scoped presets", async () => {
    const { ws } = await seed();
    const store = usePresetStore();
    await store.createPreset({
      presetTypeId: "map-style",
      workspaceId: null,
      name: "G",
      config: { styleUrl: "https://example/style.json" },
    });
    await store.createPreset({
      presetTypeId: "map-style",
      workspaceId: ws.id,
      name: "S",
      config: { styleUrl: "https://example/scoped.json" },
    });
    await store.loadForWorkspace(ws.id);
    expect(store.presets.map((p) => p.name).sort()).toEqual(["G", "S"]);
    expect(store.globalPresets.map((p) => p.name)).toEqual(["G"]);
    expect(store.workspacePresets.map((p) => p.name)).toEqual(["S"]);
  });

  it("presetsForPanel filters by applicableTo and workspace scope", async () => {
    const { ws } = await seed();
    const store = usePresetStore();
    await store.createPreset({
      presetTypeId: "map-style",
      workspaceId: null,
      name: "style",
      config: {},
    });
    await store.createPreset({
      presetTypeId: "chart-theme",
      workspaceId: null,
      name: "theme",
      config: {},
    });
    await store.loadForWorkspace(ws.id);
    expect(store.presetsForPanel("maplibre", ws.id).map((p) => p.name)).toEqual(["style"]);
    expect(store.presetsForPanel("chart", ws.id).map((p) => p.name)).toEqual(["theme"]);
    expect(store.presetsForPanel("entities", ws.id)).toEqual([]);
  });

  it("applyToPanel writes the panel-state ref and runs applyToPanel", async () => {
    const { ws, layout } = await seed();
    const store = usePresetStore();
    const panelStateStore = usePanelStateStore();
    await panelStateStore.loadForLayout(layout.id);
    const panel = await panelStateStore.createPanel({
      layoutId: layout.id,
      panelType: "maplibre",
    });
    const preset = await store.createPreset({
      presetTypeId: "map-style",
      workspaceId: ws.id,
      name: "style",
      config: { styleUrl: "https://x" },
    });
    await store.loadForWorkspace(ws.id);

    const spy = vi.fn();
    const original = presetTypeRegistry.get("map-style")!.applyToPanel;
    presetTypeRegistry.get("map-style")!.applyToPanel = spy;
    try {
      await store.applyToPanel(panel.id, preset.id);
    } finally {
      presetTypeRegistry.get("map-style")!.applyToPanel = original;
    }

    expect(spy).toHaveBeenCalledWith(panel.id, { styleUrl: "https://x" });
    const after = await panelStateRepo.getById(panel.id);
    expect(after?.appliedPresetIds).toEqual([preset.id]);
  });

  it("updatePreset re-applies to every panel referencing the preset", async () => {
    const { ws, layout } = await seed();
    const store = usePresetStore();
    const panelStateStore = usePanelStateStore();
    await panelStateStore.loadForLayout(layout.id);
    const preset = await store.createPreset({
      presetTypeId: "map-style",
      workspaceId: ws.id,
      name: "style",
      config: { styleUrl: "https://x" },
    });
    await store.loadForWorkspace(ws.id);

    const a = await panelStateStore.createPanel({
      layoutId: layout.id,
      panelType: "maplibre",
      appliedPresetIds: [preset.id],
    });
    const b = await panelStateStore.createPanel({
      layoutId: layout.id,
      panelType: "maplibre",
      appliedPresetIds: [preset.id],
    });

    const spy = vi.fn();
    const original = presetTypeRegistry.get("map-style")!.applyToPanel;
    presetTypeRegistry.get("map-style")!.applyToPanel = spy;
    try {
      await store.updatePreset(preset.id, { config: { styleUrl: "https://y" } });
    } finally {
      presetTypeRegistry.get("map-style")!.applyToPanel = original;
    }

    expect(spy).toHaveBeenCalledTimes(2);
    const callIds = spy.mock.calls.map((c) => c[0]).sort();
    expect(callIds).toEqual([a.id, b.id].sort());
  });

  it("removeFromPanel calls the type's removeFromPanel and strips the ref", async () => {
    const { ws, layout } = await seed();
    const store = usePresetStore();
    const panelStateStore = usePanelStateStore();
    await panelStateStore.loadForLayout(layout.id);
    const preset = await store.createPreset({
      presetTypeId: "map-overlay",
      workspaceId: ws.id,
      name: "overlay",
      config: { name: "x", geojsonUrl: "", color: "#000", opacity: 0.5, visible: true },
    });
    await store.loadForWorkspace(ws.id);
    const panel = await panelStateStore.createPanel({
      layoutId: layout.id,
      panelType: "maplibre",
      appliedPresetIds: [preset.id],
    });

    const spy = vi.fn();
    const original = presetTypeRegistry.get("map-overlay")!.removeFromPanel!;
    presetTypeRegistry.get("map-overlay")!.removeFromPanel = spy;
    try {
      await store.removeFromPanel(panel.id, preset.id);
    } finally {
      presetTypeRegistry.get("map-overlay")!.removeFromPanel = original;
    }

    expect(spy).toHaveBeenCalled();
    const after = await panelStateRepo.getById(panel.id);
    expect(after?.appliedPresetIds).toEqual([]);
  });
});
