import type { Command } from "../types";
import type { Feature } from "geojson";

import { useDrawingsStore } from "@/stores/drawings";

import { makeCommand } from "../factories";

/**
 * Adapters for the `drawings` store — operator-created scratch geometry that a
 * tool finalizes (`measure-distance`, `draw-polygon`).
 *
 * The store is in-memory and `add(feature)` mints a fresh nanoid each call, so
 * redo re-inserts under a **new** id. That's an accepted v1 simplification for
 * scratch geometry (decision #4 — no stable-id geometry editing yet). The
 * adapters re-capture the live id across each replay so a remove → undo → redo
 * cycle stays internally consistent and never targets a dangling id.
 */

/** Undoable "add a finalized drawing". `undo` deletes it; `redo` re-adds it. */
export function makeAddDrawingCommand(feature: Feature): Command {
  const drawings = useDrawingsStore();
  let id: string | null = null;
  return makeCommand({
    label: "Add drawing",
    scope: "drawings",
    category: "create",
    redo() {
      id = drawings.add(feature); // mints a fresh id (re-captured on every redo)
    },
    undo() {
      if (id !== null) drawings.remove(id);
    },
  });
}

/** Undoable "delete a drawing". `undo` re-inserts the captured feature. */
export function makeRemoveDrawingCommand(id: string): Command {
  const drawings = useDrawingsStore();
  const prior = drawings.drawings.find((d) => d.id === id)?.feature;
  let current = id;
  return makeCommand({
    label: "Delete drawing",
    scope: "drawings",
    category: "delete",
    redo() {
      drawings.remove(current);
    },
    undo() {
      if (prior) current = drawings.add(prior); // re-add, track the new id for the next redo
    },
  });
}

/** Undoable "clear all drawings". `undo` re-inserts every captured feature in order. */
export function makeClearDrawingsCommand(): Command {
  const drawings = useDrawingsStore();
  // Snapshot the features up front (ids are not preserved — see module note).
  const priorFeatures = drawings.drawings.map((d) => d.feature);
  return makeCommand({
    label: "Clear drawings",
    scope: "drawings",
    category: "delete",
    redo() {
      drawings.clear();
    },
    undo() {
      for (const feature of priorFeatures) drawings.add(feature);
    },
  });
}
