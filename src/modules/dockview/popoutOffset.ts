/**
 * Correct dockview's pop-out restore double-offset.
 *
 * dockview's `toJSON()` serializes each pop-out group's `position` as ABSOLUTE
 * screen coordinates (the pop-out window's `screenX`/`screenY` at save time).
 * On restore, `fromJSON` → `addPopoutGroup` re-opens the window at
 * `window.screenX + position.left` / `window.screenY + position.top` — adding
 * the MAIN window's screen offset to coordinates that are *already* absolute
 * (dockview-core 6.6.1, `dockview-core.js:14580-14581`). On a multi-monitor
 * setup — or any time the main window is not at the screen origin — the restored
 * pop-out therefore drifts by the main window's offset and can land on the wrong
 * monitor.
 *
 * This helper pre-subtracts the main window's current screen origin from each
 * saved pop-out `position`, so dockview's re-addition cancels out and the window
 * lands at its true saved absolute coordinates regardless of where the main
 * window currently sits.
 *
 * Pure and side-effect-free: returns a corrected shallow copy and never mutates
 * the input (which is the persisted layout blob). No-op when there are no
 * pop-out groups or the origin is (0, 0).
 *
 * NOTE (CLAUDE.md library-gotcha rule): this compensates for dockview's internal
 * offset math — re-verify against `dockview-core` on every major bump.
 */

/** The `Box` dockview serializes per pop-out group (`types.d.ts` `Box`). */
export interface PopoutBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The slice of a serialized pop-out group this helper touches. */
export interface SerializedPopoutGroupLike {
  position?: PopoutBox | null;
}

/** The slice of dockview's `SerializedDockview` this helper touches. */
export interface DockviewStateLike {
  popoutGroups?: SerializedPopoutGroupLike[];
}

export function correctPopoutRestoreOffset<T extends DockviewStateLike>(
  state: T,
  originX: number,
  originY: number,
): T {
  const groups = state.popoutGroups;
  if (!groups || groups.length === 0) return state;
  if (originX === 0 && originY === 0) return state;
  return {
    ...state,
    popoutGroups: groups.map((group) =>
      group && group.position
        ? {
            ...group,
            position: {
              ...group.position,
              left: group.position.left - originX,
              top: group.position.top - originY,
            },
          }
        : group,
    ),
  };
}
