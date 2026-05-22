import { beforeEach, describe, expect, it } from "vitest";

import { appMetaRepo } from "@/modules/storage/appMetaRepo";

import { resetStorage } from "./helpers";

describe("appMetaRepo", () => {
  beforeEach(async () => {
    await resetStorage();
  });

  it("returns undefined for missing keys", async () => {
    expect(await appMetaRepo.get("nope")).toBeUndefined();
  });

  it("set then get round-trips arbitrary JSON", async () => {
    await appMetaRepo.set("current-workspace-id", "abc");
    expect(await appMetaRepo.get<string>("current-workspace-id")).toBe("abc");

    await appMetaRepo.set("payload", { nested: { value: 1 } });
    expect(await appMetaRepo.get<{ nested: { value: number } }>("payload")).toEqual({
      nested: { value: 1 },
    });
  });

  it("set overwrites existing values", async () => {
    await appMetaRepo.set("k", 1);
    await appMetaRepo.set("k", 2);
    expect(await appMetaRepo.get<number>("k")).toBe(2);
  });

  it("delete removes a key", async () => {
    await appMetaRepo.set("k", 1);
    await appMetaRepo.delete("k");
    expect(await appMetaRepo.get("k")).toBeUndefined();
  });
});
