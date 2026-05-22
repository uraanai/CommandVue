import type { ChromeItemId, ChromeProfile, ChromeSlot } from "@/types/chrome";
import type { Ulid } from "@/types/workspace";

import { CHROME_SLOTS } from "@/types/chrome";

import { getDb } from "./db";
import { InvariantError, NotFoundError } from "./errors";
import { newId } from "./ids";

export interface CreateChromeProfileInput {
  name: string;
  isDefault?: boolean;
  slotAssignments?: Partial<Record<ChromeSlot, ChromeItemId[]>>;
  hiddenItems?: ChromeItemId[];
  menuBarVisible?: boolean;
  statusBarVisible?: boolean;
}

export interface UpdateChromeProfileInput {
  name?: string;
  slotAssignments?: Record<ChromeSlot, ChromeItemId[]>;
  hiddenItems?: ChromeItemId[];
  menuBarVisible?: boolean;
  statusBarVisible?: boolean;
}

function emptySlotAssignments(): Record<ChromeSlot, ChromeItemId[]> {
  const out = {} as Record<ChromeSlot, ChromeItemId[]>;
  for (const slot of CHROME_SLOTS) out[slot] = [];
  return out;
}

/**
 * Repository for {@link ChromeProfile} records.
 *
 * Invariants enforced here:
 *  - At least one profile has `isDefault: true` — `setDefault` is the atomic
 *    swap. `delete` refuses to remove the last profile and refuses to remove
 *    the default (caller must promote another first).
 */
export const chromeProfileRepo = {
  async create(input: CreateChromeProfileInput): Promise<ChromeProfile> {
    const db = await getDb();
    const now = Date.now();
    const slotAssignments = {
      ...emptySlotAssignments(),
      ...(input.slotAssignments ?? {}),
    };
    const profile: ChromeProfile = {
      id: newId(),
      name: input.name,
      isDefault: false,
      slotAssignments,
      hiddenItems: input.hiddenItems ?? [],
      menuBarVisible: input.menuBarVisible ?? true,
      statusBarVisible: input.statusBarVisible ?? true,
      createdAt: now,
      updatedAt: now,
    };

    const tx = db.transaction("chrome-profiles", "readwrite");
    if (input.isDefault) {
      const all = await tx.store.getAll();
      for (const existing of all) {
        if (existing.isDefault) {
          await tx.store.put({ ...existing, isDefault: false, updatedAt: now });
        }
      }
      profile.isDefault = true;
    }
    await tx.store.add(profile);
    await tx.done;
    return profile;
  },

  async getById(id: Ulid): Promise<ChromeProfile | undefined> {
    const db = await getDb();
    return db.get("chrome-profiles", id);
  },

  async getDefault(): Promise<ChromeProfile | undefined> {
    const db = await getDb();
    const all = await db.getAll("chrome-profiles");
    return all.find((p) => p.isDefault);
  },

  async list(): Promise<ChromeProfile[]> {
    const db = await getDb();
    const all = await db.getAll("chrome-profiles");
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },

  async update(id: Ulid, patch: UpdateChromeProfileInput): Promise<ChromeProfile> {
    const db = await getDb();
    const tx = db.transaction("chrome-profiles", "readwrite");
    const existing = await tx.store.get(id);
    if (!existing) throw new NotFoundError("ChromeProfile", id);
    const updated: ChromeProfile = { ...existing, ...patch, updatedAt: Date.now() };
    await tx.store.put(updated);
    await tx.done;
    return updated;
  },

  async setDefault(id: Ulid): Promise<void> {
    const db = await getDb();
    const tx = db.transaction("chrome-profiles", "readwrite");
    const target = await tx.store.get(id);
    if (!target) throw new NotFoundError("ChromeProfile", id);
    const now = Date.now();
    const all = await tx.store.getAll();
    for (const profile of all) {
      const shouldBeDefault = profile.id === id;
      if (profile.isDefault !== shouldBeDefault) {
        await tx.store.put({ ...profile, isDefault: shouldBeDefault, updatedAt: now });
      }
    }
    await tx.done;
  },

  async delete(id: Ulid): Promise<void> {
    const db = await getDb();
    const tx = db.transaction("chrome-profiles", "readwrite");
    const target = await tx.store.get(id);
    if (!target) throw new NotFoundError("ChromeProfile", id);
    if (target.isDefault) {
      throw new InvariantError("Cannot delete the default chrome profile");
    }
    const remaining = await tx.store.count();
    if (remaining <= 1) {
      throw new InvariantError("Cannot delete the last chrome profile");
    }
    await tx.store.delete(id);
    await tx.done;
  },
};
