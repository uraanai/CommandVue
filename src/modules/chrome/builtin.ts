import type { ChromeItemDefinition } from "./types";

import { chromeItemRegistry } from "./registry";

/**
 * The nine built-in chrome items. Order matches the spec table.
 *
 * `removable: false` is set only on `app-icon` — the always-on fallback that
 * hosts the right-click File/Edit/View context menu when the menu bar is
 * hidden. Every other item is removable.
 */
export const BUILTIN_CHROME_ITEMS: readonly ChromeItemDefinition[] = [
  {
    id: "app-icon",
    title: "App Icon",
    description: "The brand logo with a right-click File/Edit/View context menu. Always visible.",
    icon: "hexagon",
    allowedSlots: ["top-left"],
    defaultSlot: "top-left",
    component: () => import("@/components/chrome/items/AppIconItem.vue"),
    removable: false,
    singleton: true,
  },
  {
    id: "menu-bar",
    title: "Menu Bar",
    description: "The File / Edit / View menu.",
    icon: "menu",
    allowedSlots: ["top-left", "top-center"],
    defaultSlot: "top-left",
    component: () => import("@/components/chrome/items/MenuBarItem.vue"),
    removable: true,
    singleton: true,
  },
  {
    id: "workspace-switcher",
    title: "Workspace Switcher",
    description: "Dropdown to switch between workspaces.",
    icon: "layers",
    allowedSlots: ["top-left", "top-center", "top-right"],
    defaultSlot: "top-right",
    component: () => import("@/components/chrome/items/WorkspaceSwitcherItem.vue"),
    removable: true,
    singleton: true,
  },
  {
    id: "current-workspace-label",
    title: "Current Workspace",
    description: "Shows the name of the active workspace.",
    icon: "layers",
    allowedSlots: ["status-left", "status-center", "status-right"],
    defaultSlot: "status-left",
    component: () => import("@/components/chrome/items/WorkspaceLabelItem.vue"),
    removable: true,
    singleton: true,
  },
  {
    id: "current-layout-label",
    title: "Current Layout",
    description: "Shows the name of the active layout.",
    icon: "layout-panel-left",
    allowedSlots: ["status-left", "status-center", "status-right"],
    defaultSlot: "status-left",
    component: () => import("@/components/chrome/items/LayoutLabelItem.vue"),
    removable: true,
    singleton: true,
  },
  {
    id: "dirty-indicator",
    title: "Unsaved Changes Indicator",
    description: "Lights up when the current layout has unsaved changes.",
    icon: "circle",
    allowedSlots: ["status-left", "status-center", "status-right"],
    defaultSlot: "status-left",
    component: () => import("@/components/chrome/items/DirtyIndicatorItem.vue"),
    removable: true,
    singleton: true,
  },
  {
    id: "websocket-status",
    title: "WebSocket Status",
    description: "Connection state for the realtime WebSocket.",
    icon: "wifi",
    allowedSlots: ["status-left", "status-center", "status-right"],
    defaultSlot: "status-right",
    component: () => import("@/components/chrome/items/WebSocketStatusItem.vue"),
    removable: true,
    singleton: true,
  },
  {
    id: "clock",
    title: "Clock (System + GMT)",
    description: "System time and GMT offset, updated every second.",
    icon: "clock",
    allowedSlots: ["status-left", "status-center", "status-right"],
    defaultSlot: "status-right",
    component: () => import("@/components/chrome/items/ClockItem.vue"),
    removable: true,
    singleton: true,
  },
  {
    id: "edit-mode-toggle",
    title: "Edit Mode Toggle",
    description: "Enter or exit chrome edit mode to rearrange items.",
    icon: "pencil",
    allowedSlots: ["status-left", "status-center", "status-right"],
    defaultSlot: "status-right",
    component: () => import("@/components/chrome/items/EditModeToggleItem.vue"),
    removable: true,
    singleton: true,
  },
  {
    id: "theme-toggle",
    title: "Theme Toggle (Light/Dark)",
    description:
      "Flip between light and dark mode. Two-mode for now; Prompt 3 will add an Auto option.",
    icon: "sun",
    allowedSlots: [
      "top-left",
      "top-center",
      "top-right",
      "status-left",
      "status-center",
      "status-right",
    ],
    defaultSlot: "top-right",
    component: () => import("@/components/chrome/items/ThemeToggleItem.vue"),
    removable: true,
    singleton: true,
  },
] as const;

let registered = false;

export function registerBuiltinChromeItems(): void {
  if (registered) return;
  for (const def of BUILTIN_CHROME_ITEMS) chromeItemRegistry.register(def);
  registered = true;
}

/** Test-only — clear the builtin registration. */
export function __unregisterBuiltinChromeItemsForTests(): void {
  chromeItemRegistry.__resetForTests();
  registered = false;
}
