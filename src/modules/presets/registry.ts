import type { PresetTypeDefinition, PresetTypeRegistrySubscriber } from "./types";
import type { PresetTypeId } from "@/types/preset";
import type { PanelType } from "@/types/workspace";

/**
 * Singleton preset-type registry.
 *
 * Same pattern as `panelRegistry` and `chromeItemRegistry`. Populated by
 * `registerBuiltinPresetTypes()` (in `src/modules/presets/builtin.ts`) once
 * at startup; downstream apps add their own types via `register`.
 */
class PresetTypeRegistry {
  private definitions = new Map<PresetTypeId, PresetTypeDefinition>();
  private subscribers = new Set<PresetTypeRegistrySubscriber>();

  register<TConfig extends Record<string, unknown>>(def: PresetTypeDefinition<TConfig>): void {
    if (this.definitions.has(def.id)) {
      throw new Error(`Preset type already registered: ${def.id}`);
    }
    this.definitions.set(def.id, def as PresetTypeDefinition);
    this.notify();
  }

  unregister(id: PresetTypeId): void {
    if (this.definitions.delete(id)) this.notify();
  }

  get(id: PresetTypeId): PresetTypeDefinition | undefined {
    return this.definitions.get(id);
  }

  list(): PresetTypeDefinition[] {
    return Array.from(this.definitions.values());
  }

  /** All preset types applicable to a given panel type. */
  listFor(panelType: PanelType): PresetTypeDefinition[] {
    return this.list().filter((def) => def.applicableTo.includes(panelType));
  }

  subscribe(cb: PresetTypeRegistrySubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.list());
    return () => this.subscribers.delete(cb);
  }

  /** Test-only — clear everything. */
  __resetForTests(): void {
    this.definitions.clear();
    this.subscribers.clear();
  }

  private notify(): void {
    const snapshot = this.list();
    for (const cb of this.subscribers) cb(snapshot);
  }
}

export const presetTypeRegistry = new PresetTypeRegistry();
