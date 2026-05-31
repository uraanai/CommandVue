/**
 * Pure decision-logic for the clean-pane controls. Kept separate from
 * `DockContextMenu.vue` so it can be unit-tested without mounting Vue or
 * dockview (the component itself is Stage-1 Playwright-verified per the
 * CommandVue verification protocol).
 */
export interface CleanPaneControlInput {
  /** Whether the hovered group is currently clean (header hidden). */
  isHeaderless: boolean;
  /** Total panels in the whole layout (drives the empty-workspace guard). */
  totalPanels: number;
}

export interface CleanPaneControl {
  id: "toggle-header" | "split" | "close";
  label: string;
  /** Lucide component name (must exist in @lucide/vue@1.16). */
  icon: "PanelTop" | "PanelTopClose" | "SquareSplitHorizontal" | "X";
  disabled: boolean;
}

export function cleanPaneControls(input: CleanPaneControlInput): CleanPaneControl[] {
  return [
    {
      id: "toggle-header",
      label: input.isHeaderless ? "Show header" : "Hide header",
      icon: input.isHeaderless ? "PanelTop" : "PanelTopClose",
      disabled: false,
    },
    {
      id: "split",
      label: "Split",
      icon: "SquareSplitHorizontal",
      disabled: false,
    },
    {
      id: "close",
      label: "Close",
      icon: "X",
      disabled: input.totalPanels <= 1,
    },
  ];
}
