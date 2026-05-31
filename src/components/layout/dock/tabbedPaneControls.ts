/**
 * Pure decision-logic for the tabbed-pane context menu. Mirrors
 * `cleanPaneControls.ts` -- kept separate from `DockContextMenu.vue` so it can
 * be unit-tested without mounting Vue or dockview (the component itself is
 * Stage-1 Playwright-verified per the CommandVue verification protocol).
 */
export interface TabbedPaneControlInput {
  /** Total panels in the whole layout (drives the empty-workspace guard). */
  totalPanels: number;
  /** Panels in the right-clicked panel's group (drives "Close others"). */
  panelsInGroup: number;
  /** Whether the right-clicked panel's group is currently maximized. */
  isMaximized: boolean;
}

export interface TabbedPaneControl {
  id: "close" | "close-others" | "hide-header" | "maximize";
  label: string;
  /** Lucide component name (must exist in @lucide/vue@1.16). */
  icon: "X" | "Columns2" | "PanelTopClose" | "Maximize2" | "Minimize2";
  disabled: boolean;
}

export function tabbedPaneControls(input: TabbedPaneControlInput): TabbedPaneControl[] {
  return [
    {
      id: "close",
      label: "Close",
      icon: "X",
      disabled: input.totalPanels <= 1,
    },
    {
      id: "close-others",
      label: "Close others",
      icon: "Columns2",
      disabled: input.panelsInGroup <= 1,
    },
    {
      id: "hide-header",
      label: "Hide header",
      icon: "PanelTopClose",
      disabled: false,
    },
    {
      id: "maximize",
      label: input.isMaximized ? "Restore" : "Maximize",
      icon: input.isMaximized ? "Minimize2" : "Maximize2",
      disabled: false,
    },
  ];
}
