import type { PanelType } from "@/types/workspace";

import { panelRegistry } from "./registry";

/**
 * Synthetic panel type used by Dockview when a panel-state has
 * `panelType: null` (assignment state: `empty`). The string is deliberately
 * underscore-prefixed so it cannot collide with a real registered panel id.
 *
 * `UnassignedPanel.vue` is registered in `main.ts` via
 * `app.component(UNASSIGNED_PANEL_TYPE, ...)` so Dockview can resolve it.
 * The registry entry below is intentionally minimal — the unassigned panel
 * is not user-spawnable from the Components Panel or View → Add Component
 * menu (filtered out by id), it only appears for panel-states explicitly
 * created via the View → Add Empty Panel flow.
 */
export const UNASSIGNED_PANEL_TYPE: PanelType = "__unassigned__";

let registered = false;

export function registerUnassignedPanel(): void {
  if (registered) return;
  panelRegistry.register({
    id: UNASSIGNED_PANEL_TYPE,
    title: "Empty Panel",
    description: "Placeholder for an unassigned panel. Pick a component to fill it.",
    icon: "square",
    category: "tools",
    component: () => import("@/components/panels/UnassignedPanel.vue"),
  });
  registered = true;
}

/** Test-only — undo `registerUnassignedPanel`. */
export function __unregisterUnassignedPanelForTests(): void {
  panelRegistry.unregister(UNASSIGNED_PANEL_TYPE);
  registered = false;
}
