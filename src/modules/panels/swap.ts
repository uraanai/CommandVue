import type { DockviewApi, DockviewPanelApi } from "dockview-vue";

/**
 * Replace the component backing a live Dockview panel, preserving its id.
 *
 * Why a remove-then-add dance: Dockview binds a panel's component at creation
 * — there is no `setComponent`. To change it we remove the old panel and add a
 * new one with the **same id**, so the panel-state record, any applied presets,
 * and `layout.panelIds` (all keyed by panel id) stay wired to the new panel.
 *
 * Order matters: Dockview 6 rejects a duplicate id at `addPanel` time, so the
 * old panel is closed FIRST — `close()` is synchronous, which frees the id
 * before we re-add. The previous implementation added-then-closed and threw
 * `panel with id X already exists`, silently aborting the swap (the visible
 * symptom: the UnassignedPanel "Assign" / MissingPanelPlaceholder "Reassign"
 * buttons appeared to do nothing).
 *
 * Location: capture the group before closing. If it still holds siblings it
 * survives the close, so the replacement re-joins it (`direction: "within"`).
 * If the closed panel was the group's last — the common empty-placeholder case,
 * which is created floating — the group is disposed with it, so we re-add
 * floating and let Dockview place it rather than reference a dead group.
 */
export function swapPanelComponent(
  dockApi: DockviewApi,
  panelApi: DockviewPanelApi,
  options: { component: string; title: string },
): void {
  const panelId = panelApi.id;
  const group = panelApi.group;
  panelApi.close();

  // `group` may be undefined if the panel was already detached; `!= null`
  // guards that and lets us check whether the group outlived the close.
  if (group != null && dockApi.groups.some((g) => g.id === group.id)) {
    dockApi.addPanel({
      id: panelId,
      component: options.component,
      title: options.title,
      position: { referenceGroup: group.id, direction: "within" },
    });
  } else {
    dockApi.addPanel({
      id: panelId,
      component: options.component,
      title: options.title,
      floating: true,
    });
  }
}
