import type { Command, HistoryCategory } from "../types";

import { useSessionStore } from "@/stores/session";

import { makeCommand } from "../factories";

/**
 * Wrap a Dockview layout mutation in an undoable snapshot-inverse command.
 * `redo` captures the layout JSON before running `mutate`, then after; `undo`
 * re-applies the before-JSON via `fromJSON` (inside `setRestoring` so it doesn't
 * re-mark dirty or re-record). A later redo replays the captured after-JSON.
 *
 * Best fit: panel add/remove (close window, close-all). A removed panel's
 * `panel-state` record survives `api.removePanel`, so the `fromJSON` undo
 * re-mounts it cleanly.
 *
 * v1 caveats: `api.toJSON()` does NOT serialize header-hidden, float-opacity, or
 * float-maximized fill — those derived visuals aren't perfectly restored by a
 * dock-layout undo (float opacity is separately undoable via
 * `makeSetFloatAlphaCommand`). A per-tab close uses Dockview's own control and
 * isn't routed through history.
 */
export function makeDockviewLayoutCommand(
  label: string,
  mutate: () => Promise<void> | void,
  opts?: { category?: HistoryCategory },
): Command {
  const session = useSessionStore();
  let before: unknown = null;
  let after: unknown = null;

  function applyJson(json: unknown): void {
    const api = session.getDockviewApi();
    if (!api || json === null) return;
    session.setRestoring(true);
    try {
      api.fromJSON(json as Parameters<typeof api.fromJSON>[0]);
    } finally {
      session.setRestoring(false);
    }
    session.markDirty();
  }

  return makeCommand({
    label,
    scope: "dockview-layout",
    category: opts?.category ?? "arrange",
    async redo() {
      const api = session.getDockviewApi();
      if (!api) return;
      if (after !== null) {
        applyJson(after); // replay the captured target on a redo
        return;
      }
      before = api.toJSON();
      await mutate();
      after = api.toJSON();
    },
    undo() {
      applyJson(before);
    },
  });
}
