import type { PresetTypeId } from "@/types/preset";
import type { PanelType, Ulid } from "@/types/workspace";
import type { Component } from "vue";

/**
 * Contract for a registered preset type.
 *
 * A preset type defines:
 *  - The shape of its `config` (via `defaultConfig` + optional JSON schema).
 *  - Which panel types it can be applied to (`applicableTo`).
 *  - How to edit it (`editComponent` — async-loaded Vue component).
 *  - How to apply / remove it at runtime (`applyToPanel` / `removeFromPanel`).
 *
 * Runtime application reaches the panel via the panel-instance registry
 * (`src/modules/panels/instances.ts`). Panels register their imperative
 * handle on mount; preset apply functions read that handle by panel id.
 *
 * Applying is **idempotent** — re-applying an already-applied preset is
 * a valid operation. Cascading order is enforced by the caller (the panel),
 * which iterates `appliedPresetIds` in order.
 */
export interface PresetTypeDefinition<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
> {
  id: PresetTypeId;
  title: string;
  description: string;
  /** Lucide icon name. */
  icon: string;
  /** Panel types this preset can be applied to. Use registry ids (e.g. `"maplibre"`). */
  applicableTo: readonly PanelType[];
  defaultConfig: TConfig;
  /**
   * Async loader for the preset's edit UI. Receives `{ modelValue, 'onUpdate:modelValue' }`
   * via v-model.
   */
  editComponent: () => Promise<Component>;
  /**
   * Runtime apply. Called by the panel after mount and on any subsequent
   * change to the panel's `appliedPresetIds`. The function looks up the
   * panel instance via `getPanelInstance` and mutates it imperatively.
   */
  applyToPanel: (panelId: Ulid, config: TConfig) => Promise<void> | void;
  /**
   * Runtime remove. Counterpart to `applyToPanel`. Many preset types are
   * additive and have a no-op remove (the next `applyToPanel` of the next
   * preset in the cascade replaces the visual). Override when removal
   * needs explicit teardown (e.g. an overlay layer).
   */
  removeFromPanel?: (panelId: Ulid, config: TConfig) => Promise<void> | void;
}

export type PresetTypeRegistrySubscriber = (defs: PresetTypeDefinition[]) => void;
