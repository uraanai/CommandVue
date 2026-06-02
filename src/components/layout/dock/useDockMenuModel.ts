import type { DockviewGroupPanel, IDockviewPanel } from "dockview-vue";
import type { MenuItem } from "primevue/menuitem";
import type { Component } from "vue";

import {
  Columns2,
  ExternalLink,
  Maximize2,
  Minimize,
  Minimize2,
  Minus,
  PanelTop,
  PanelTopClose,
  PinOff,
  PictureInPicture2,
  SquareArrowOutUpRight,
  X,
} from "@lucide/vue";

import { useMinimizedStore } from "@/stores/minimized";
import { useSessionStore } from "@/stores/session";

import { cleanPaneControls } from "./cleanPaneControls";
import { floatPaneControl } from "./floatPaneControls";
import { tabbedPaneControls } from "./tabbedPaneControls";

/** Menu item shape with a Lucide component attached for the shared `#item` slot. */
export type DockMenuItem = MenuItem & { lucide?: Component };

/** Per-surface tweaks for the dock menu. */
export interface DockMenuModelOptions {
  /**
   * Supplied only by the pop-out-window menu. When set, the window action becomes
   * a single "Dock back to main window" (wired to this callback — closing the
   * pop-out window, which dockview natively re-docks into the opener) instead of
   * the "Pop out…" item(s), which are meaningless once already in a pop-out.
   */
  onDockBack?: () => void;
}

/**
 * Builds the dock context-menu model for a right-clicked group. Extracted from
 * `DockContextMenu.vue` so the SAME model drives two surfaces (Track B Phase 6c):
 *
 *  - the main-window menu (`DockContextMenu`, listener on the dock root), and
 *  - the per-pop-out-window menu (`DockPopoutContextMenu`, listener on the child
 *    window's document) — so right-clicking inside a pop-out shows our menu, not
 *    the browser's native one.
 *
 * The builders are location-aware via `panel.api.location.type`, so the same model
 * renders correctly in every window: Float / Maximize / Minimize that can't apply
 * off their home location come back DISABLED rather than silently dead. Pure
 * label/disabled logic still lives in the `*PaneControls.ts` helpers (unit-tested);
 * this composable only maps those to menu items + wires the session/minimize
 * actions. Stage-1 Playwright-verified at the component level (no unit test).
 */
export function useDockMenuModel(): {
  buildModelForGroup: (
    group: DockviewGroupPanel,
    totalPanels: number,
    opts?: DockMenuModelOptions,
  ) => DockMenuItem[];
} {
  const session = useSessionStore();
  const minimized = useMinimizedStore();

  /**
   * Maximize/Restore item shared by both menus. Label + icon flip on the LIVE
   * state, read fresh on each right-click (the model is rebuilt on open):
   *  - **grid** group → dockview's native group maximize.
   *  - **floating** group → the custom fill-the-dock ⇄ restore (Track B Phase 4b),
   *    the SAME action as the float header's maximize icon.
   *  - **pop-out / edge** group → disabled (no maximize concept).
   */
  function maximizeItem(panel: IDockviewPanel): DockMenuItem {
    const location = panel.api.location.type;
    if (location === "floating") {
      const maximized = session.getFloatMaximized(panel.id);
      return {
        label: maximized ? "Restore" : "Maximize",
        lucide: maximized ? Minimize2 : Maximize2,
        command: () => void session.toggleFloatMaximize(panel.id),
      };
    }
    const maximized = panel.api.isMaximized();
    return {
      label: maximized ? "Restore" : "Maximize",
      lucide: maximized ? Minimize2 : Maximize2,
      disabled: location !== "grid",
      command: () => void session.toggleMaximize(panel.id),
    };
  }

  /**
   * Float / Dock-back item. On a grid pane it reads "Float window" (disabled
   * off-grid, mirroring maximizeItem); on a floating pane it reads "Dock back".
   */
  function floatItem(panel: IDockviewPanel): DockMenuItem {
    const control = floatPaneControl({ location: panel.api.location.type });
    return {
      label: control.label,
      lucide: control.icon === "PinOff" ? PinOff : PictureInPicture2,
      disabled: control.disabled,
      command: () =>
        void (control.id === "dock-back"
          ? session.dockBack(panel.id)
          : session.floatPanel(panel.id)),
    };
  }

  /**
   * Pop-out item(s) (Track B Phase 6a). A multi-tab group offers "Pop out tab"
   * (just the active panel) and "Pop out group" (every tab → one window); a
   * single-panel group collapses the two into one "Pop out to window".
   */
  function popOutItems(panel: IDockviewPanel, panelsInGroup: number): DockMenuItem[] {
    if (panelsInGroup > 1) {
      return [
        {
          label: "Pop out tab",
          lucide: ExternalLink,
          command: () => void session.popOutPanel(panel.id),
        },
        {
          label: "Pop out group",
          lucide: SquareArrowOutUpRight,
          command: () => void session.popOutGroup(panel.id),
        },
      ];
    }
    return [
      {
        label: "Pop out to window",
        lucide: ExternalLink,
        command: () => void session.popOutGroup(panel.id),
      },
    ];
  }

  /**
   * The window-management item(s) for a group. In the MAIN window these are the
   * "Pop out…" item(s); INSIDE a pop-out (`opts.onDockBack` set) they collapse to a
   * single "Dock back to main window" — popping a pop-out out again is meaningless,
   * and the relevant move is back to the opener. `onDockBack` closes the pop-out
   * window, which dockview re-docks into the original location.
   */
  function windowItems(
    panel: IDockviewPanel,
    panelsInGroup: number,
    opts?: DockMenuModelOptions,
  ): DockMenuItem[] {
    if (opts?.onDockBack) {
      return [{ label: "Dock back to main window", lucide: PinOff, command: opts.onDockBack }];
    }
    return popOutItems(panel, panelsInGroup);
  }

  /**
   * Minimize item(s) (Track B Phase 4c). A multi-tab group offers "Minimize tab"
   * + "Minimize group"; a single-panel group offers one "Minimize". The tray is a
   * MAIN-window surface and the store actions only minimize grid/float groups, so
   * in a pop-out (or edge) group these come back DISABLED — keeping menu parity
   * with the main window without a silently-dead click.
   */
  function minimizeItems(panel: IDockviewPanel, panelsInGroup: number): DockMenuItem[] {
    const location = panel.api.location.type;
    const disabled = location !== "grid" && location !== "floating";
    if (panelsInGroup > 1) {
      return [
        {
          label: "Minimize tab",
          lucide: Minus,
          disabled,
          command: () => void minimized.minimizePanel(panel.id),
        },
        {
          label: "Minimize group",
          lucide: Minimize,
          disabled,
          command: () => void minimized.minimizeGroup(panel.id),
        },
      ];
    }
    return [
      {
        label: "Minimize",
        lucide: Minus,
        disabled,
        command: () => void minimized.minimizeGroup(panel.id),
      },
    ];
  }

  /**
   * CLEAN pane menu (group.header.hidden === true). Show header / Float / Pop out /
   * Maximize / Minimize / -- / Close. No Split item by design (Add-Component menu +
   * dockview drag-to-split cover it). A clean pane is a single visible pane, so the
   * Pop-out / Minimize items use the single-item ("whole group") form.
   */
  function buildCleanModel(
    panel: IDockviewPanel,
    totalPanels: number,
    opts?: DockMenuModelOptions,
  ): DockMenuItem[] {
    const controls = cleanPaneControls({ isHeaderless: true, totalPanels });
    const showHeader = controls.find((c) => c.id === "toggle-header");
    const close = controls.find((c) => c.id === "close");

    return [
      {
        label: showHeader?.label ?? "Show header",
        lucide: PanelTop,
        command: () => void session.toggleHeaderless(panel.id),
      },
      floatItem(panel),
      ...windowItems(panel, 1, opts),
      maximizeItem(panel),
      ...minimizeItems(panel, 1),
      { separator: true },
      {
        label: "Close",
        lucide: X,
        disabled: close?.disabled ?? false,
        command: () => void session.removePanelGuarded(panel.id),
      },
    ];
  }

  /**
   * TABBED pane menu (group.header.hidden === false). Hide header / Close others /
   * Float / Pop out / Maximize / Minimize / -- / Close.
   */
  function buildTabbedModel(
    panel: IDockviewPanel,
    panelsInGroup: number,
    totalPanels: number,
    opts?: DockMenuModelOptions,
  ): DockMenuItem[] {
    const controls = tabbedPaneControls({ totalPanels, panelsInGroup });
    const close = controls.find((c) => c.id === "close")!;
    const closeOthers = controls.find((c) => c.id === "close-others")!;

    return [
      {
        label: "Hide header",
        lucide: PanelTopClose,
        command: () => void session.toggleHeaderless(panel.id),
      },
      {
        label: closeOthers.label,
        lucide: Columns2,
        disabled: closeOthers.disabled,
        command: () => void session.closeOthersInGroup(panel.id),
      },
      floatItem(panel),
      ...windowItems(panel, panelsInGroup, opts),
      maximizeItem(panel),
      ...minimizeItems(panel, panelsInGroup),
      { separator: true },
      {
        label: close.label,
        lucide: X,
        disabled: close.disabled,
        command: () => void session.removePanelGuarded(panel.id),
      },
    ];
  }

  /**
   * Pick the right model for a right-clicked group: clean (header hidden) vs tabbed.
   * `totalPanels` (`api.panels.length`) drives the Close empty-workspace guard.
   * Returns `[]` when the group has no panels (caller should not open a menu).
   */
  function buildModelForGroup(
    group: DockviewGroupPanel,
    totalPanels: number,
    opts?: DockMenuModelOptions,
  ): DockMenuItem[] {
    const panel = group.activePanel ?? group.panels[0];
    if (!panel) return [];
    return group.header.hidden
      ? buildCleanModel(panel, totalPanels, opts)
      : buildTabbedModel(panel, group.panels.length, totalPanels, opts);
  }

  return { buildModelForGroup };
}
