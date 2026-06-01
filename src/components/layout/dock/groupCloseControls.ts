/**
 * Pure logic for the group "Close All" header action (Track B Phase 4a).
 *
 * Kept separate from the component (like `tabbedPaneControls` / `cleanPaneControls`)
 * so the count math is unit-testable without mounting dockview.
 */

/**
 * How many panels a Close All on a group will ACTUALLY remove, honoring the
 * empty-workspace guard in `session.closeAllInGroup` (`api.panels.length <= 1`
 * stops the final removal). When the group IS the whole layout, its last pane
 * survives, so one fewer closes than the group holds; otherwise every panel in
 * the group closes (other groups keep the layout non-empty).
 *
 * @param groupPanelCount panels in the target group
 * @param totalPanelCount panels across the whole layout
 */
export function panelsThatWillClose(groupPanelCount: number, totalPanelCount: number): number {
  if (totalPanelCount > groupPanelCount) return groupPanelCount;
  // Group is the whole layout: the guard keeps its last pane.
  return Math.max(0, groupPanelCount - 1);
}
