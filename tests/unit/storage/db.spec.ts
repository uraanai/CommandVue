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
    expect(db.version).toBe(3);
    expect(db.objectStoreNames.contains("custom-themes")).toBe(true);
  });

  it("does not downgrade: reopens at the existing higher version instead of throwing VersionError", async () => {
    // Simulate a newer build of the app having created the DB at version 4
    // (a superset of our stores) in the same browser profile.
    await seedExistingDbAtVersion(4, ["workspaces", "custom-themes", "future-store"]);
    await __resetDbForTests();

    // getDb requests version 3; a naive openDB would throw VersionError.
    const db = await getDb();
    expect(db.version).toBe(4);
    // The stores this build knows about are still present and usable.
    expect(db.objectStoreNames.contains("custom-themes")).toBe(true);
  });

  it("migrates v1 custom-theme records to the v2 base+overrides shape on upgrade to v3", async () => {
    // Seed two v1-shaped records at DB version 2: one static (imported, no
    // generation) and one re-derivable (generated). The generated one exercises
    // the synchronous generateTheme call INSIDE the versionchange transaction —
    // it must not auto-commit the transaction.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("custom-themes")) {
          db.createObjectStore("custom-themes", { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("custom-themes", "readwrite");
        const store = tx.objectStore("custom-themes");
        store.put({
          id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          name: "Legacy Imported",
          description: "",
          author: "",
          source: "imported",
          mode: "light",
          density: "comfortable",
          tokens: { "--color-surface-base": "oklch(0.98 0.005 250)" },
          createdAt: 1,
          updatedAt: 2,
        });
        store.put({
          id: "01BRZ3NDEKTSV4RRFFQ69G5FAV",
          name: "Legacy Generated",
          description: "",
          author: "",
          source: "generated",
          mode: "dark",
          density: "comfortable",
          tokens: { "--color-surface-base": "oklch(0.15 0.04 264)" },
          generation: {
            schemaVersion: 1,
            baseColor: "oklch(0.15 0.04 264)",
            accentColor: "oklch(0.6 0.18 250)",
            contrast: 60,
          },
          createdAt: 3,
          updatedAt: 4,
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
    await __resetDbForTests();

    // Open at v3 → the upgrade runs the migration.
    const db = await getDb();
    expect(db.version).toBe(3);

    const imported = (await db.get("custom-themes", "01ARZ3NDEKTSV4RRFFQ69G5FAV")) as {
      base: { kind: string; tokens?: Record<string, string> };
      overrides: Record<string, string>;
      tokens: Record<string, string>;
    };
    expect(imported.base).toEqual({
      kind: "static",
      tokens: { "--color-surface-base": "oklch(0.98 0.005 250)" },
    });
    expect(imported.overrides).toEqual({});
    expect(imported.tokens).toEqual({ "--color-surface-base": "oklch(0.98 0.005 250)" });

    const generated = (await db.get("custom-themes", "01BRZ3NDEKTSV4RRFFQ69G5FAV")) as {
      base: { kind: string; input?: { baseColor: string } };
      tokens: Record<string, string>;
    };
    expect(generated.base.kind).toBe("generated"); // re-derivable base built from the generation block
    expect(generated.base.input?.baseColor).toBe("oklch(0.15 0.04 264)");
    expect(generated.tokens["--color-surface-base"]).toBe("oklch(0.15 0.04 264)"); // cache preserved verbatim
  });
});
