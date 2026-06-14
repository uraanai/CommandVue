import type { Command } from "../types";
import type { Ulid } from "@/types/workspace";

import { usePanelStateStore } from "@/stores/panelState";
import { useSessionStore } from "@/stores/session";

import { makeCommand } from "../factories";
import { capturePatches, makePatchCommand } from "../patches";

/**
 * Generic undoable edit of a panel's nested `state` blob via immer
 * inverse-patches. `recipe` mutates a draft; the forward + inverse patch sets
 * are captured once and replayed through the real `updateState` action (idb +
 * reactive cache), so undo reverts exactly the keys the recipe touched and
 * nothing else.
 *
 * This is the building block downstream apps wrap their panel-settings forms
 * with. Pass a `coalesceKey` to merge rapid same-control edits (slider drags).
 */
export function makeUpdatePanelStateCommand(
  panelId: Ulid,
  recipe: (draft: Record<string, unknown>) => void,
  opts?: { label?: string; coalesceKey?: string },
): Command {
  const ps = usePanelStateStore();
  const base = ps.getState(panelId)?.state ?? {};
  const { patches, inversePatches } = capturePatches(base, recipe);
  return makePatchCommand({
    label: opts?.label ?? "Edit panel",
    scope: "panel-state",
    category: "update",
    patches,
    inversePatches,
    read: () => ps.getState(panelId)?.state ?? {},
    write: (state) =>
      ps.updateState(panelId, { state: state as Record<string, unknown> }).then(() => {}),
    coalesceKey: opts?.coalesceKey,
    meta: { panelId },
  });
}

/**
 * Undoable window-opacity change for a floating group. `session.setFloatAlpha`
 * is group-wide (writes every panel in the group + the `--cv-float-alpha` CSS
 * var), and runs on both redo and undo — so the visible glass repaints on
 * undo, not just the persisted state. The prior alpha is captured up front;
 * the `coalesceKey` collapses a drag into one undo step (keeping the original
 * baseline + the final value).
 */
export function makeSetFloatAlphaCommand(panelId: Ulid, nextAlpha: number): Command {
  const session = useSessionStore();
  const priorAlpha = session.getFloatAlpha(panelId);
  return makeCommand({
    label: "Adjust window opacity",
    scope: "panel-state",
    category: "update",
    coalesceKey: `float-alpha:${panelId}`,
    redo() {
      return session.setFloatAlpha(panelId, nextAlpha);
    },
    undo() {
      return session.setFloatAlpha(panelId, priorAlpha);
    },
  });
}
