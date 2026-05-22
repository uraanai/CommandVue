import type { PanelType } from "@/types/workspace";

import { panelRegistry } from "./registry";

/**
 * Synthetic panel type used by DockLayout when a panel-state record references
 * a `panelType` that isn't in the panel registry (e.g. a workspace imported
 * from a different build).
 *
 * Like `UNASSIGNED_PANEL_TYPE`, this is underscore-prefixed and registered
 * with `panelRegistry` so Dockview can resolve the component, but it's
 * filtered out of every user-facing list (Components Panel, Add Component
 * cascade) because users never spawn a missing panel intentionally.
 */
export const MISSING_PANEL_TYPE: PanelType = "__missing__";

let registered = false;

export function registerMissingPanel(): void {
  if (registered) return;
  panelRegistry.register({
    id: MISSING_PANEL_TYPE,
    title: "Missing Panel",
    description: "Placeholder for a panel whose component is no longer registered.",
    icon: "alert-triangle",
    category: "tools",
    component: () => import("@/components/panels/MissingPanelPlaceholder.vue"),
  });
  registered = true;
}

/** Test-only — undo the registration. */
export function __unregisterMissingPanelForTests(): void {
  panelRegistry.unregister(MISSING_PANEL_TYPE);
  registered = false;
}
