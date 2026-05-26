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
    dbPromise = openDB<CommandVueDb>(DB_NAME, DB_VERSION, {
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
  }
  return dbPromise;
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
