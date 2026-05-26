import { beforeEach, describe, expect, it } from "vitest";

import { __resetDbForTests, getDb } from "@/modules/storage/db";

import { resetStorage } from "./helpers";

const DB_NAME = "commandvue-workspaces";

/** Open the DB at an explicit version with the given store names, then close. */
function seedExistingDbAtVersion(version: number, stores: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of stores) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe("getDb", () => {
  beforeEach(async () => {
    await resetStorage();
  });

  it("opens fresh at the current version with the custom-themes store", async () => {
    const db = await getDb();
    expect(db.version).toBe(2);
    expect(db.objectStoreNames.contains("custom-themes")).toBe(true);
  });

  it("does not downgrade: reopens at the existing higher version instead of throwing VersionError", async () => {
    // Simulate a newer build of the app having created the DB at version 3
    // (a superset of our stores) in the same browser profile.
    await seedExistingDbAtVersion(3, ["workspaces", "custom-themes", "future-store"]);
    await __resetDbForTests();

    // getDb requests version 2; a naive openDB would throw VersionError.
    const db = await getDb();
    expect(db.version).toBe(3);
    // The stores this build knows about are still present and usable.
    expect(db.objectStoreNames.contains("custom-themes")).toBe(true);
  });
});
