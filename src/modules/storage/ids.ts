import type { Ulid } from "@/types/workspace";

import { ulid } from "ulid";

/**
 * Generate a new ULID (Universally Unique Lexicographically Sortable Id).
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
export function newId(): Ulid {
  return ulid();
}
