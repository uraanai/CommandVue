import type { Feature } from "geojson";

import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import {
  makeAddDrawingCommand,
  makeClearDrawingsCommand,
  makeRemoveDrawingCommand,
} from "@/modules/history/adapters";
import { useDrawingsStore } from "@/stores/drawings";
import { useHistoryStore } from "@/stores/history";

function pointFeature(lng: number, lat: number): Feature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {},
  };
}

beforeEach(() => {
  // Drawings is an in-memory store (no idb) — a fresh Pinia is enough.
  setActivePinia(createPinia());
});

describe("drawings adapter — add", () => {
  it("execute adds, undo removes, redo re-adds (round-trip through the real store)", async () => {
    const drawings = useDrawingsStore();
    const history = useHistoryStore();

    await history.execute(makeAddDrawingCommand(pointFeature(1, 2)));
    expect(drawings.count).toBe(1);
    expect(history.canUndo).toBe(true);
    expect(history.undoLabel).toBe("Add drawing");

    await history.undo();
    expect(drawings.count).toBe(0);
    expect(history.canRedo).toBe(true);

    await history.redo();
    expect(drawings.count).toBe(1);
  });
});

describe("drawings adapter — remove", () => {
  it("execute removes an existing drawing, undo restores it, redo removes again", async () => {
    const drawings = useDrawingsStore();
    const history = useHistoryStore();
    const id = drawings.add(pointFeature(3, 4)); // pre-existing drawing
    expect(drawings.count).toBe(1);

    await history.execute(makeRemoveDrawingCommand(id));
    expect(drawings.count).toBe(0);

    await history.undo();
    expect(drawings.count).toBe(1); // restored

    await history.redo();
    expect(drawings.count).toBe(0); // re-removed (id re-captured across the cycle)
  });
});

describe("drawings adapter — clear", () => {
  it("execute clears all, undo restores them, redo clears again", async () => {
    const drawings = useDrawingsStore();
    const history = useHistoryStore();
    drawings.add(pointFeature(1, 1));
    drawings.add(pointFeature(2, 2));
    expect(drawings.count).toBe(2);

    await history.execute(makeClearDrawingsCommand());
    expect(drawings.count).toBe(0);

    await history.undo();
    expect(drawings.count).toBe(2); // both restored

    await history.redo();
    expect(drawings.count).toBe(0);
  });
});
