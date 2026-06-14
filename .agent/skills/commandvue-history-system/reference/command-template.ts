/**
 * Copy-paste scaffold for a history adapter.
 *
 * Drop a copy into `src/modules/history/adapters/<store>.ts`, keep the pattern
 * that matches your store, delete the others, and wire at the user-intent
 * boundary with `await history.execute(makeXCommand(...))`. Export from
 * `adapters/index.ts` and add a round-trip test under
 * `tests/unit/history/adapters/`.
 *
 * This file is illustrative (it lives under .agent/skills and is not compiled).
 * See SKILL.md and docs/undo-redo.md.
 */
import { capturePatches, makeCommand, makePatchCommand } from "@/modules/history";
import type { Command } from "@/modules/history";
// import { useXStore } from "@/stores/x";
// import { getDb } from "@/modules/storage/db";

// ── 1. In-memory create (redo adds, undo removes) ────────────────────────────
export function makeAddXCommand(payload: unknown): Command {
  // const store = useXStore();
  let id: string | null = null;
  return makeCommand({
    label: "Add X",
    scope: "drawings", // pick the right HistoryScope
    category: "create",
    redo() {
      // Capture on redo — runs on the initial execute AND every replay.
      // id = store.add(payload);
    },
    undo() {
      // The real inverse.
      // if (id) store.remove(id);
    },
  });
}

// ── 2. Persisted blob edit via immer inverse-patches ─────────────────────────
export function makeEditXCommand(
  id: string,
  recipe: (draft: Record<string, unknown>) => void,
): Command {
  // const store = useXStore();
  const base: Record<string, unknown> = {}; // store.getState(id)?.state ?? {}
  const { patches, inversePatches } = capturePatches(base, recipe);
  return makePatchCommand({
    label: "Edit X",
    scope: "panel-state",
    category: "update",
    patches,
    inversePatches,
    read: () => ({}), // () => store.getState(id)?.state ?? {}
    write: () => {}, // (next) => store.updateState(id, { state: next })
    coalesceKey: `x:${id}`, // optional — collapse rapid same-control edits
  });
}

// ── 3. Persisted delete — snapshot + restore by ORIGINAL id ──────────────────
export function makeDeleteXCommand(id: string): Command {
  // const store = useXStore();
  let snapshot: unknown = null;
  return makeCommand({
    label: "Delete X",
    scope: "preset",
    category: "delete",
    async redo() {
      // const db = await getDb();
      // snapshot = await db.get("x", id);   // read the full record BEFORE delete
      // await store.delete(id);
    },
    async undo() {
      // const db = await getDb();
      // await db.add("x", snapshot);        // raw re-insert by ORIGINAL id
      // await store.reload();               // re-sync the shallowRef cache
    },
  });
}
