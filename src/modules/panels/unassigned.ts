import type { PanelType } from "@/types/workspace";

/**
 * Synthetic panel type used by Dockview when a panel-state has
 * `panelType: null` (assignment state: `empty`). The string is deliberately
 * underscore-prefixed so it cannot collide with a real registered panel id.
 *
 * Phase B reserves the constant and exposes it for downstream wiring. The
 * actual `UnassignedPanel.vue` component and its registration (both via
 * `panelRegistry.register` and `app.component`) land in Phase D — that's
 * where the empty-state UI with the "Assign a component…" dropdown lives.
 */
export const UNASSIGNED_PANEL_TYPE: PanelType = "__unassigned__";
