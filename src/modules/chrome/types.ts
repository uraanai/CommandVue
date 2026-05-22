import type { ChromeItemId, ChromeSlot } from "@/types/chrome";
import type { Component } from "vue";

/**
 * Chrome item registry contract.
 *
 * Phase E populates the registry with nine built-ins (app-icon, menu-bar,
 * workspace-switcher, current-workspace-label, current-layout-label,
 * dirty-indicator, websocket-status, clock, edit-mode-toggle). Downstream
 * applications add their own items at startup via `chromeItemRegistry.register`.
 *
 * `removable: false` items can never be dragged to the trash zone and cannot
 * be unregistered. `app-icon` is the only such item — it's the always-on
 * fallback that hosts the right-click File/Edit/View context menu when the
 * menu bar is hidden.
 */
export interface ChromeItemDefinition {
  id: ChromeItemId;
  title: string;
  description: string;
  /** Lucide icon name (e.g. `"clock"`, `"menu"`, `"hash"`). */
  icon: string;
  allowedSlots: readonly ChromeSlot[];
  defaultSlot?: ChromeSlot;
  /** Async loader. Items are code-split lazy chunks. */
  component: () => Promise<Component>;
  /** False for app-icon; true for every other built-in. */
  removable: boolean;
  /** True when only one instance is allowed (every built-in is singleton). */
  singleton: boolean;
}

export type ChromeRegistrySubscriber = (items: ChromeItemDefinition[]) => void;
