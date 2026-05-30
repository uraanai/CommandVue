import { getDb } from "./db";

/**
 * Tiny key/value bag for runtime pointers (current workspace, current
 * layout, last-opened-at timestamps) that don't justify their own table.
 *
 * Values are persisted as-is; callers own JSON-serializability.
 */
export const appMetaRepo = {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const db = await getDb();
    const record = await db.get("app-meta", key);
    return record?.value as T | undefined;
  },

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const db = await getDb();
    await db.put("app-meta", { key, value });
  },

  async delete(key: string): Promise<void> {
    const db = await getDb();
    await db.delete("app-meta", key);
  },

  /**
   * Return every stored key that starts with `prefix`. Used to find all
   * per-workspace theme bindings (`commandvue:workspace-theme-*`) when a
   * custom theme is deleted. The store is tiny, so a full key scan is cheap.
   */
  async getKeysByPrefix(prefix: string): Promise<string[]> {
    const db = await getDb();
    const keys = await db.getAllKeys("app-meta");
    return keys.filter((k): k is string => typeof k === "string" && k.startsWith(prefix));
  },
};
