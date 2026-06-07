import type { PanelType } from "@/types/workspace";
import type { Component } from "vue";

/**
 * Panel categories — used by the View menu to group "Add Component" entries
 * and by the Components Panel browser. Keep this list short; pick the
 * closest match when registering a new panel rather than inventing a
 * one-off category.
 */
export type PanelCategory = "charts" | "data" | "docs" | "maps" | "monitoring" | "tools";

/**
 * Lifecycle hooks for per-panel state. Wired to actual implementations in
 * Phase G. Phase B leaves these as stubs so the registry contract is
 * stable before the panels start opting in.
 */
export interface PanelLifecycle {
  /**
   * Capture the current panel state into a plain-object payload that idb
   * can persist. Returns whatever shape the panel's Phase G state schema
   * specifies. Called on debounced layout changes and on save.
   */
  serialize?: (panelId: string) => Record<string, unknown> | Promise<Record<string, unknown>>;

  /**
   * Restore a previously serialized payload onto a freshly mounted panel.
   * Called once after the component mounts, before any preset application.
   * Receives whatever `serialize` produced; the panel is expected to be
   * defensive against partial / older shapes.
   */
  restore?: (panelId: string, state: Record<string, unknown>) => Promise<void> | void;
}

export interface PanelDefinition extends PanelLifecycle {
  /**
   * Stable string ID matched by Dockview's `component:` lookup and by
   * `panel-states.panelType` in storage. The ID must also be registered
   * globally via `app.component()` (see `src/main.ts`) — dockview-vue 6
   * resolves panel components by walking the global registry, not via a
   * `:components` prop.
   */
  id: PanelType;

  /** User-facing title shown in menus, the Components Panel, and tab fallbacks. */
  title: string;

  /** One-line user-facing description shown alongside the title. */
  description: string;

  /**
   * Lucide icon name (e.g. `"map"`, `"globe"`, `"bar-chart-3"`). UI chrome
   * looks this up via `@lucide/vue` icon components.
   */
  icon: string;

  category: PanelCategory;

  /**
   * Async loader returning the panel's Vue component. Phase D drag-from-
   * Components-Panel and the Add Component menu both call this when the
   * user opens a new instance. The registry never imports the component
   * eagerly — it stays a code-split chunk until the first instance.
   */
  component: () => Promise<Component>;

  /**
   * Whether only one instance of this panel may exist at a time. The
   * Components Panel uses this to grey-out already-open singletons in the
   * "Add" affordance.
   */
  singleton?: boolean;

  /**
   * Marks this panel type as the default "clean" (header-less) pane for the
   * clean-panes model (Track B). When seeding or rebuilding a layout, the
   * first `mainPane` type is added as its own clean group (no tab strip) and
   * the idempotent legacy backfill promotes it to clean if nothing else is.
   * Additive and orthogonal to `singleton`.
   */
  mainPane?: boolean;
}

/** Subscription callback for `panelRegistry.subscribe`. */
export type PanelRegistrySubscriber = (panels: PanelDefinition[]) => void;
