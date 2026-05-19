import type { InjectionKey } from "vue";

/**
 * Provide / inject keys for the layout chrome.
 *
 * `DockLayout.vue` provides `resetLayoutKey`; `TitleBar.vue` injects it to
 * wire the "Reset layout" button without coupling the two through the store.
 */
export const resetLayoutKey: InjectionKey<() => void> = Symbol("commandvue:resetLayout");
