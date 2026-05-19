import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "commandvue";
const DB_VERSION = 1;
const STORE_NAME = "keyval";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Read a value from the `keyval` object store. Returns `undefined` when the
 * key is absent. Values are JSON-serialized by the structured-clone protocol —
 * keep them simple (no DOM refs, no class instances).
 */
export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return (await db.get(STORE_NAME, key)) as T | undefined;
}

/**
 * Write a value to the `keyval` object store.
 */
export async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, value, key);
}

/**
 * Remove a key from the `keyval` object store.
 */
export async function idbDel(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, key);
}

/**
 * Clear every key in the `keyval` object store. Use sparingly — wipes user
 * state.
 */
export async function idbClear(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE_NAME);
}
