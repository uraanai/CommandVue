/**
 * Pure decision-logic for the Float / Dock-back context-menu item. Mirrors
 * `cleanPaneControls.ts` / `tabbedPaneControls.ts` — kept separate from
 * `DockContextMenu.vue` so it can be unit-tested without mounting Vue or
 * dockview. The component maps the result to a menu item (it reads the live
 * `panel.api.location.type` and wires the command to the session action).
 */
export interface FloatPaneControlInput {
  /** The right-clicked pane's dockview group location. */
  location: "grid" | "floating" | "popout" | "edge";
}

export interface FloatPaneControl {
  id: "float" | "dock-back";
  label: string;
  /** Lucide component name (must exist in @lucide/vue@1.16). */
  icon: "PictureInPicture2" | "PinOff";
  /**
   * "Float window" is grid-only (mirrors maximize's grid gate — floating /
   * pop-out / edge groups cannot be floated again). "Dock back" is always
   * enabled (it only ever appears on a floating pane).
   */
  disabled: boolean;
}

export function floatPaneControl(input: FloatPaneControlInput): FloatPaneControl {
  return input.location === "floating"
    ? { id: "dock-back", label: "Dock back", icon: "PinOff", disabled: false }
    : {
        id: "float",
        label: "Float window",
        icon: "PictureInPicture2",
        disabled: input.location !== "grid",
      };
}
