import { beforeEach, describe, expect, it } from "vitest";

import { layoutRepo } from "@/modules/storage/layoutRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";
import { usePanelStateStore } from "@/stores/panelState";

import { resetForStoreTest } from "./helpers";

async function makeLayout() {
  const ws = await workspaceRepo.create({ name: "WS", isGlobalDefault: true });
  return layoutRepo.create({ workspaceId: ws.id, name: "L" });
}

describe("usePanelStateStore", () => {
  beforeEach(async () => {
    await resetForStoreTest();
  });

  it("loadForLayout populates the map keyed by panel id", async () => {
    const layout = await makeLayout();
    const store = usePanelStateStore();
    await store.createPanel({ layoutId: layout.id, panelType: "cesium" });
    await store.createPanel({ layoutId: layout.id, panelType: "maplibre" });

    await store.loadForLayout(layout.id);
    expect(store.statesByPanelId.size).toBe(2);
    expect(store.loadedLayoutId).toBe(layout.id);
  });

  it("createEmptyPanel persists with empty assignmentState", async () => {
    const layout = await makeLayout();
    const store = usePanelStateStore();
    await store.loadForLayout(layout.id);
    const panel = await store.createEmptyPanel(layout.id);
    expect(panel.panelType).toBeNull();
    expect(panel.assignmentState).toBe("empty");
    expect(store.statesByPanelId.has(panel.id)).toBe(true);
  });

  it("assignComponent swaps the type and bumps assignmentState", async () => {
    const layout = await makeLayout();
    const store = usePanelStateStore();
    await store.loadForLayout(layout.id);
    const panel = await store.createEmptyPanel(layout.id);
    await store.assignComponent(panel.id, "cesium", "configured");
    const after = store.getState(panel.id);
    expect(after?.panelType).toBe("cesium");
    expect(after?.assignmentState).toBe("configured");
  });

  it("clearComponent wipes the panel type and resets state", async () => {
    const layout = await makeLayout();
    const store = usePanelStateStore();
    await store.loadForLayout(layout.id);
    const panel = await store.createPanel({
      layoutId: layout.id,
      panelType: "cesium",
      state: { foo: 1 },
    });
    await store.clearComponent(panel.id);
    const after = store.getState(panel.id);
    expect(after?.panelType).toBeNull();
    expect(after?.assignmentState).toBe("empty");
    expect(after?.state).toEqual({});
  });

  it("applyPreset adds to appliedPresetIds; removePreset removes", async () => {
    const layout = await makeLayout();
    const store = usePanelStateStore();
    await store.loadForLayout(layout.id);
    const panel = await store.createPanel({ layoutId: layout.id, panelType: "maplibre" });
    await store.applyPreset(panel.id, "p-A");
    await store.applyPreset(panel.id, "p-B");
    expect(store.getState(panel.id)?.appliedPresetIds).toEqual(["p-A", "p-B"]);
    await store.removePreset(panel.id, "p-A");
    expect(store.getState(panel.id)?.appliedPresetIds).toEqual(["p-B"]);
  });

  it("deletePanel removes the entry from the map", async () => {
    const layout = await makeLayout();
    const store = usePanelStateStore();
    await store.loadForLayout(layout.id);
    const panel = await store.createEmptyPanel(layout.id);
    await store.deletePanel(panel.id);
    expect(store.getState(panel.id)).toBeUndefined();
  });

  it("listForLayout returns panels sorted by createdAt", async () => {
    const layout = await makeLayout();
    const store = usePanelStateStore();
    await store.loadForLayout(layout.id);
    const a = await store.createPanel({ layoutId: layout.id, panelType: "cesium" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await store.createPanel({ layoutId: layout.id, panelType: "maplibre" });
    expect(store.listForLayout().map((p) => p.id)).toEqual([a.id, b.id]);
  });
});
