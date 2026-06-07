/**
 * Typed lazy loader + helpers over the bundled Google-font snapshot (Track A C3).
 *
 * The catalog JSON is `import()`-ed INSIDE these functions, never a top-level
 * import — so it code-splits into its own chunk and never lands in the boot
 * path. The curated `offline: true` families MUST set-equal
 * `CURATED_OFFLINE_FAMILIES` in `useFontLoader.ts` (drift-guarded by a test).
 */
import fuzzysort from "fuzzysort";

export interface FontCatalogEntry {
  family: string;
  category: "display" | "handwriting" | "monospace" | "sans-serif" | "serif";
  variants: number[];
  offline?: boolean;
}
export interface FontCatalog {
  version: number;
  generatedAt: string;
  families: FontCatalogEntry[];
}

let catalogPromise: null | Promise<FontCatalog> = null;
let byFamily: Map<string, FontCatalogEntry> | null = null;

/** Lazily import()+parse the bundled JSON (code-split out of the main chunk). Cached. */
export function loadFontCatalog(): Promise<FontCatalog> {
  catalogPromise ??= import("@/assets/fonts/google-catalog.json").then((mod) => {
    const raw = (mod.default ?? mod) as FontCatalog;
    // Trim defensively — FontFamilyNameSchema forbids a leading space.
    const families = raw.families.map((e) => ({ ...e, family: e.family.trim() }));
    byFamily = new Map(families.map((e) => [e.family, e]));
    return { version: raw.version, generatedAt: raw.generatedAt, families };
  });
  return catalogPromise;
}

/** Indexed lookup by exact (trimmed) family name. */
export async function getCatalogEntry(family: string): Promise<FontCatalogEntry | undefined> {
  await loadFontCatalog();
  return byFamily?.get(family.trim());
}

/** The curated offline-ready subset (entry.offline === true). */
export async function curatedOfflineFamilies(): Promise<FontCatalogEntry[]> {
  const cat = await loadFontCatalog();
  return cat.families.filter((e) => e.offline === true);
}

/** fuzzysort prefix/fuzzy search over family names (for the picker). */
export async function searchFamilies(query: string, limit = 50): Promise<FontCatalogEntry[]> {
  const cat = await loadFontCatalog();
  const q = query.trim();
  if (!q) return cat.families.slice(0, limit);
  return fuzzysort.go(q, cat.families, { key: "family", limit }).map((r) => r.obj);
}

/** Hermetic-test seam — drop the cached catalog so the next load re-imports. */
export function __clearCatalogCacheForTests(): void {
  catalogPromise = null;
  byFamily = null;
}
