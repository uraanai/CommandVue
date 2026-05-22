import "fake-indexeddb/auto";

import { __resetDbForTests } from "@/modules/storage/db";

/**
 * Reset both the idb singleton and the in-memory fake-indexeddb store
 * between tests. Call this in `beforeEach`.
 */
export async function resetStorage(): Promise<void> {
  await __resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("commandvue-workspaces");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
