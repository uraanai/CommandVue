import { beforeEach, describe, expect, it } from "vitest";

import { chromeProfileRepo } from "@/modules/storage/chromeProfileRepo";
import { InvariantError, NotFoundError } from "@/modules/storage/errors";

import { resetStorage } from "./helpers";

describe("chromeProfileRepo", () => {
  beforeEach(async () => {
    await resetStorage();
  });

  it("creates a profile with empty slot assignments by default", async () => {
    const profile = await chromeProfileRepo.create({ name: "P" });
    expect(profile.slotAssignments["top-left"]).toEqual([]);
    expect(profile.slotAssignments["status-right"]).toEqual([]);
    expect(profile.menuBarVisible).toBe(true);
    expect(profile.statusBarVisible).toBe(true);
  });

  it("setting isDefault on create flips any prior default off", async () => {
    const a = await chromeProfileRepo.create({ name: "A", isDefault: true });
    const b = await chromeProfileRepo.create({ name: "B", isDefault: true });
    const a2 = await chromeProfileRepo.getById(a.id);
    expect(a2?.isDefault).toBe(false);
    expect(b.isDefault).toBe(true);
  });

  it("getDefault returns the current default", async () => {
    await chromeProfileRepo.create({ name: "A" });
    const b = await chromeProfileRepo.create({ name: "B", isDefault: true });
    const got = await chromeProfileRepo.getDefault();
    expect(got?.id).toBe(b.id);
  });

  it("setDefault is atomic — exactly one profile ends with the flag", async () => {
    const a = await chromeProfileRepo.create({ name: "A", isDefault: true });
    const b = await chromeProfileRepo.create({ name: "B" });
    const c = await chromeProfileRepo.create({ name: "C" });

    await chromeProfileRepo.setDefault(c.id);

    const all = await chromeProfileRepo.list();
    const defaults = all.filter((p) => p.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.id).toBe(c.id);
    expect((await chromeProfileRepo.getById(a.id))?.isDefault).toBe(false);
    expect((await chromeProfileRepo.getById(b.id))?.isDefault).toBe(false);
  });

  it("update merges fields", async () => {
    const profile = await chromeProfileRepo.create({ name: "Old" });
    const updated = await chromeProfileRepo.update(profile.id, {
      name: "New",
      menuBarVisible: false,
    });
    expect(updated.name).toBe("New");
    expect(updated.menuBarVisible).toBe(false);
  });

  it("delete refuses to remove the default profile", async () => {
    const a = await chromeProfileRepo.create({ name: "A", isDefault: true });
    await chromeProfileRepo.create({ name: "B" });
    await expect(chromeProfileRepo.delete(a.id)).rejects.toBeInstanceOf(InvariantError);
  });

  it("delete refuses to remove the last profile", async () => {
    const solo = await chromeProfileRepo.create({ name: "Solo", isDefault: true });
    await expect(chromeProfileRepo.delete(solo.id)).rejects.toBeInstanceOf(InvariantError);
  });

  it("delete throws NotFoundError on missing id", async () => {
    await expect(chromeProfileRepo.delete("nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("delete removes a non-default profile when others exist", async () => {
    await chromeProfileRepo.create({ name: "A", isDefault: true });
    const b = await chromeProfileRepo.create({ name: "B" });
    await chromeProfileRepo.delete(b.id);
    expect(await chromeProfileRepo.getById(b.id)).toBeUndefined();
  });
});
