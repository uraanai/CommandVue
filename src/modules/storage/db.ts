import type { ChromeProfile } from "@/types/chrome";
import type { Preset } from "@/types/preset";
import type { Theme } from "@/types/theme";
import type { AppMeta, Layout, PanelState, Workspace } from "@/types/workspace";

import { type DBSchema, type IDBPDatabase, openDB } from "idb";

const DB_NAME = "commandvue-workspaces";
const DB_VERSION = 2;

/**
 * IndexedDB schema (version 1).
 *
 * Six object stores, all keyed by entity id (ULID) except `app-meta` which
 * is keyed by a string `key`. Indexes mirror the access patterns the
 * repositories actually use.
 *
 * Note: IndexedDB cannot index boolean fields portably (booleans aren't valid
 * IDBKey values per spec). Lookups like "the global-default workspace" or
 * "the default chrome profile" use a full-store scan — workspaces and chrome
 * profiles are always tiny, so the scan is cheap and the code stays simple.
 *
 * When bumping `DB_VERSION`, extend the `upgrade` callback with the new
 * migration steps. Never edit existing migration steps after release — users
 * carry old DB versions forward.
 */
export interface CommandVueDb extends DBSchema {
  workspaces: {
    key: string;
    value: Workspace;
  };
  layouts: {
    key: string;
    value: Layout;
    indexes: {
      "by-workspace": string;
    };
  };
  "panel-states": {
    key: string;
    value: PanelState;
    indexes: {
      "by-layout": string;
    };
  };
  presets: {
    key: string;
    value: Preset;
    indexes: {
      "by-workspace": string;
      "by-presetType": string;
    };
  };
  "chrome-profiles": {
    key: string;
    value: ChromeProfile;
  };
  "app-meta": {
    key: string;
    value: AppMeta;
  };
  "custom-themes": {
    key: string;
    value: Theme;
    indexes: {
      "by-name": string;
      "by-source": string;
    };
  };
}

let dbPromise: null | Promise<IDBPDatabase<CommandVueDb>> = null;

export function getDb(): Promise<IDBPDatabase<CommandVueDb>> {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((err: unknown) => {
      // Don't cache a failed open — let the next caller retry rather than
      // wedge the app on a one-off failure.
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

async function openDatabase(): Promise<IDBPDatabase<CommandVueDb>> {
  try {
    return await openDB<CommandVueDb>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("workspaces", { keyPath: "id" });

          const layouts = db.createObjectStore("layouts", { keyPath: "id" });
          layouts.createIndex("by-workspace", "workspaceId");

          const panelStates = db.createObjectStore("panel-states", { keyPath: "id" });
          panelStates.createIndex("by-layout", "layoutId");

          const presets = db.createObjectStore("presets", { keyPath: "id" });
          presets.createIndex("by-workspace", "workspaceId");
          presets.createIndex("by-presetType", "presetTypeId");

          db.createObjectStore("chrome-profiles", { keyPath: "id" });

          db.createObjectStore("app-meta", { keyPath: "key" });
        }
        if (oldVersion < 2) {
          // Prompt 4 Phase A: custom themes (user / imported / generated).
          // Built-ins are NOT stored here — they're registered from JSON.
          const customThemes = db.createObjectStore("custom-themes", { keyPath: "id" });
          customThemes.createIndex("by-name", "name");
          customThemes.createIndex("by-source", "source");
        }
      },
    });
  } catch (err) {
    // A newer build of the app already opened this database at a HIGHER
    // version in the same browser profile, and IndexedDB refuses to
    // *downgrade* — it throws `VersionError`. This bites developers who test a
    // branch with a higher `DB_VERSION` and then run an older build in the
    // same profile (and end users across a rollback). Migrations here are
    // additive and never edited after release, so a higher version is always a
    // superset of the stores this build knows about. Reopen at whatever
    // version already exists, with no upgrade — non-destructive (it never
    // deletes data); the extra newer stores are simply ignored by this build.
    if (isVersionError(err)) {
      return await openDB<CommandVueDb>(DB_NAME);
    }
    throw err;
  }
}

/**
 * `VersionError` is thrown when the requested version is lower than the
 * database's existing version. Duck-typed on `.name` rather than
 * `instanceof DOMException` so it matches both the browser's `DOMException`
 * and fake-indexeddb's error objects in tests.
 */
function isVersionError(err: unknown): boolean {
  return (
    typeof err === "object" && err !== null && (err as { name?: unknown }).name === "VersionError"
  );
}

/**
 * Reset the singleton — exclusively for tests. Closes any open connection
 * first so `indexedDB.deleteDatabase` doesn't block. Real callers must never
 * close the DB; idb manages the connection lifecycle automatically.
 */
export async function __resetDbForTests(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // Ignore — singleton may have been mid-open.
    }
  }
  dbPromise = null;
}
