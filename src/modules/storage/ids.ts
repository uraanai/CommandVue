import type { Ulid } from "@/types/workspace";

import { monotonicFactory } from "ulid";

/**
 * Generate a new ULID (Universally Unique Lexicographically Sortable Id).
 *
 * Uses the **monotonic** factory so two ULIDs minted in the same millisecond
 * are guaranteed to be lexicographically increasing. Without this, IDB key
 * order can disagree with creation order for same-millisecond writes — which
 * breaks the "ORDER BY created_at" assumption everywhere we list records.
 *
 * Why ULID over nanoid for persisted entities: time-ordered prefix makes
 * cursor pagination cheap, gives us natural insertion order in indexes, and
 * survives the eventual move to Postgres without a schema rewrite — Postgres
 * has first-class ULID support via the `pg_ulid` extension and ULIDs are
 * byte-comparable with UUID columns in the meantime.
 *
 * `src/utils/id.ts` keeps its nanoid exports for ephemeral ids (message ids,
 * client-side correlation tokens). Don't reach for nanoid for anything that
 * lands in IndexedDB.
 */
const monotonic = monotonicFactory();

export function newId(): Ulid {
  return monotonic();
}
