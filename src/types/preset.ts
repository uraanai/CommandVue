/**
 * Presets — typed bundles of visual configuration that one or more panels
 * across one or more layouts can reference. A preset's `config` shape is
 * defined by its registered {@link PresetTypeId} (see
 * `src/modules/presets/registry.ts`, added in Phase F).
 *
 * Scope: a preset is **global** when `workspaceId` is `null`, otherwise it is
 * scoped to that workspace. Global presets survive workspace deletion;
 * workspace-scoped presets cascade-delete with their owner.
 */

import type { Ulid } from "./workspace";

export type PresetTypeId = string;

export interface Preset {
  id: Ulid;
  presetTypeId: PresetTypeId;
  workspaceId: Ulid | null;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}
