import type { PanelCategory, PanelDefinition, PanelRegistrySubscriber } from "./types";
import type { PanelType } from "@/types/workspace";

/**
 * Singleton panel registry.
 *
 * The registry is the single source of truth for "what panel types exist
 * in this app." It is populated once at startup by `registerBuiltinPanels()`
 * and may be extended at runtime by downstream applications (e.g. a
 * domain-specific app that adds a Weather Radar panel).
 *
 * Dockview resolves panel components by string name via Vue's global
 * component registry (`app.component(id, ...)`); the registry does NOT
 * replace that wiring — it sits alongside it and adds metadata, async
 * loaders for menu UI, lifecycle hooks for state serialization, and the
 * `applicableTo` contract for presets (Phase F).
 */
class PanelRegistry {
  private definitions = new Map<PanelType, PanelDefinition>();
  private subscribers = new Set<PanelRegistrySubscriber>();

  register(definition: PanelDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Panel type already registered: ${definition.id}`);
    }
    this.definitions.set(definition.id, definition);
    this.notify();
  }

  unregister(id: PanelType): void {
    if (this.definitions.delete(id)) {
      this.notify();
    }
  }

  get(id: PanelType): PanelDefinition | undefined {
    return this.definitions.get(id);
  }

  list(): PanelDefinition[] {
    return Array.from(this.definitions.values());
  }

  listByCategory(): Record<PanelCategory, PanelDefinition[]> {
    const grouped: Partial<Record<PanelCategory, PanelDefinition[]>> = {};
    for (const def of this.definitions.values()) {
      const bucket = grouped[def.category] ?? (grouped[def.category] = []);
      bucket.push(def);
    }
    for (const list of Object.values(grouped)) list?.sort((a, b) => a.title.localeCompare(b.title));
    return grouped as Record<PanelCategory, PanelDefinition[]>;
  }

  subscribe(cb: PanelRegistrySubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.list());
    return () => {
      this.subscribers.delete(cb);
    };
  }

  /** Test-only — clears every registration so a spec can start clean. */
  __resetForTests(): void {
    this.definitions.clear();
    this.subscribers.clear();
  }

  private notify(): void {
    const snapshot = this.list();
    for (const cb of this.subscribers) cb(snapshot);
  }
}

export const panelRegistry = new PanelRegistry();
