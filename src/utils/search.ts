/**
 * Fuzzy search wrapper — wires up in Phase 7 alongside the command palette.
 * Stubbed today so consumers can already import from `@/utils/search`.
 */

export interface SearchResult<T> {
  item: T;
  score: number;
}

export function fuzzySearch<T>(_query: string, items: readonly T[]): SearchResult<T>[] {
  // Naive identity for now; Phase 7 replaces with fuzzysort.go(query, items, opts).
  return items.map((item) => ({ item, score: 0 }));
}
