import type { ChromeItemDefinition, ChromeRegistrySubscriber } from "./types";
import type { ChromeItemId, ChromeSlot } from "@/types/chrome";

/**
 * Singleton chrome-item registry.
 *
 * Mirrors the panel-registry design. Populated once at startup by
 * `registerBuiltinChromeItems()` and extensible at runtime by downstream
 * applications. The chrome store reads from here; chrome components subscribe
 * via `subscribe()` to pick up new items without remounting.
 */
class ChromeItemRegistry {
  private items = new Map<ChromeItemId, ChromeItemDefinition>();
  private subscribers = new Set<ChromeRegistrySubscriber>();

  register(definition: ChromeItemDefinition): void {
    if (this.items.has(definition.id)) {
      throw new Error(`Chrome item already registered: ${definition.id}`);
    }
    this.items.set(definition.id, definition);
    this.notify();
  }

  unregister(id: ChromeItemId): void {
    const existing = this.items.get(id);
    if (!existing) return;
    if (!existing.removable) {
      throw new Error(`Chrome item ${id} is not removable`);
    }
    this.items.delete(id);
    this.notify();
  }

  get(id: ChromeItemId): ChromeItemDefinition | undefined {
    return this.items.get(id);
  }

  list(): ChromeItemDefinition[] {
    return Array.from(this.items.values());
  }

  listForSlot(slot: ChromeSlot): ChromeItemDefinition[] {
    return this.list().filter((def) => def.allowedSlots.includes(slot));
  }

  subscribe(cb: ChromeRegistrySubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.list());
    return () => this.subscribers.delete(cb);
  }

  /** Test-only — clear everything so a spec can start clean. */
  __resetForTests(): void {
    this.items.clear();
    this.subscribers.clear();
  }

  private notify(): void {
    const snapshot = this.list();
    for (const cb of this.subscribers) cb(snapshot);
  }
}

export const chromeItemRegistry = new ChromeItemRegistry();
