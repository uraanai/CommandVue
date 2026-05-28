import type { Theme, ThemeId, ThemeMode } from "@/types/theme";

/**
 * Theme registry (Phase 3.3).
 *
 * Singleton in-memory store of every theme available to the app — both the
 * six built-ins shipped under `src/assets/themes/` and any custom themes a
 * downstream app registers at runtime (Prompt 4 wires a UI for that).
 *
 * Mirrors the panel + preset + chrome-item registries in shape so future
 * agent sessions know where to look when adding theme-system features.
 */

type Listener = (themes: readonly Theme[]) => void;

const themes = new Map<ThemeId, Theme>();
const listeners = new Set<Listener>();

function notify(): void {
  const snapshot = Array.from(themes.values());
  for (const listener of listeners) listener(snapshot);
}

export const themeRegistry = {
  /** Register a theme. Throws when the id is already registered. */
  register(theme: Theme): void {
    if (themes.has(theme.id)) {
      throw new Error(`Theme already registered: ${theme.id}`);
    }
    themes.set(theme.id, theme);
    notify();
  },

  /** Remove a theme by id. No-op if the id isn't registered. */
  unregister(id: ThemeId): void {
    if (themes.delete(id)) notify();
  },

  /** Get a theme by id. Returns `undefined` for unknown ids. */
  get(id: ThemeId): Theme | undefined {
    return themes.get(id);
  },

  /** Snapshot of every registered theme. */
  list(): readonly Theme[] {
    return Array.from(themes.values());
  },

  /** Built-in themes only (the six shipped variants today). */
  listBuiltIn(): readonly Theme[] {
    return Array.from(themes.values()).filter((t) => t.source === "built-in");
  },

  /** Themes that did NOT ship as a bundled built-in (user-authored, generated, or imported). */
  listCustom(): readonly Theme[] {
    return Array.from(themes.values()).filter((t) => t.source !== "built-in");
  },

  /** Themes produced by the Linear-style generation engine (Phase B). */
  listGenerated(): readonly Theme[] {
    return Array.from(themes.values()).filter((t) => t.source === "generated");
  },

  /** Themes imported from a `PortableTheme` JSON file (Phase D / G). */
  listImported(): readonly Theme[] {
    return Array.from(themes.values()).filter((t) => t.source === "imported");
  },

  /** Themes whose intrinsic `mode` matches the filter. */
  listByMode(mode: ThemeMode): readonly Theme[] {
    return Array.from(themes.values()).filter((t) => t.mode === mode);
  },

  /**
   * Hydrate the registry with any custom themes persisted in storage. The
   * caller supplies the fetcher so the registry stays independent of the
   * storage layer (avoids a circular import between `registry` and
   * `themeRepo`, and keeps tests trivial to mock).
   *
   * Built-in registration MUST already be complete before this runs so we
   * never overwrite an id the built-ins own. Already-registered ids are
   * skipped silently — `themeRepo.create` separately wires the live sync
   * for runtime mutations after boot.
   */
  async loadFromRepo(fetcher: () => Promise<readonly Theme[]>): Promise<void> {
    const customs = await fetcher();
    let added = 0;
    for (const t of customs) {
      if (!themes.has(t.id)) {
        themes.set(t.id, t);
        added += 1;
      }
    }
    if (added > 0) notify();
  },

  /**
   * Subscribe to registry changes. Returns an unsubscribe function. The
   * listener is invoked immediately with the current set so subscribers
   * don't need a separate hydration step.
   */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(Array.from(themes.values()));
    return () => {
      listeners.delete(listener);
    };
  },

  /** Test-only — clear every registered theme. Don't call from app code. */
  __resetForTests(): void {
    themes.clear();
    listeners.clear();
  },
};
