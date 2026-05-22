import { beforeEach, describe, expect, it } from "vitest";

import { chromeProfileRepo } from "@/modules/storage/chromeProfileRepo";
import { useChromeStore } from "@/stores/chrome";

import { resetForStoreTest } from "../stores/helpers";

async function seedDefaultProfile() {
  return chromeProfileRepo.create({
    name: "Default",
    isDefault: true,
    slotAssignments: {
      "top-left": ["app-icon", "menu-bar"],
      "top-center": [],
      "top-right": ["workspace-switcher"],
      "status-left": ["current-workspace-label"],
      "status-center": [],
      "status-right": ["clock"],
    },
  });
}

describe("useChromeStore", () => {
  beforeEach(async () => {
    await resetForStoreTest();
  });

  it("loadProfiles selects the default profile", async () => {
    const def = await seedDefaultProfile();
    const store = useChromeStore();
    await store.loadProfiles();
    expect(store.currentProfileId).toBe(def.id);
    expect(store.menuBarVisible).toBe(true);
    expect(store.statusBarVisible).toBe(true);
  });

  it("canEdit returns true (Phase E stub)", () => {
    const store = useChromeStore();
    expect(store.canEdit).toBe(true);
  });

  it("enterEditMode / exitEditMode / toggleEditMode toggle the flag", () => {
    const store = useChromeStore();
    expect(store.editMode).toBe(false);
    store.enterEditMode();
    expect(store.editMode).toBe(true);
    store.exitEditMode();
    expect(store.editMode).toBe(false);
    store.toggleEditMode();
    expect(store.editMode).toBe(true);
    store.toggleEditMode();
    expect(store.editMode).toBe(false);
  });

  it("addItemToSlot strips the item from other slots before inserting", async () => {
    await seedDefaultProfile();
    const store = useChromeStore();
    await store.loadProfiles();
    // app-icon currently lives in top-left
    await store.addItemToSlot("clock", "top-center");
    expect(store.slotItems("status-right")).toEqual([]);
    expect(store.slotItems("top-center")).toEqual(["clock"]);
  });

  it("removeItemFromSlot hides the item", async () => {
    await seedDefaultProfile();
    const store = useChromeStore();
    await store.loadProfiles();
    await store.removeItemFromSlot("clock", "status-right");
    expect(store.slotItems("status-right")).toEqual([]);
    expect(store.currentProfile?.hiddenItems).toContain("clock");
  });

  it("moveItem is equivalent to addItemToSlot (strips + inserts)", async () => {
    await seedDefaultProfile();
    const store = useChromeStore();
    await store.loadProfiles();
    await store.moveItem("clock", "status-right", "status-left", 0);
    expect(store.slotItems("status-right")).toEqual([]);
    expect(store.slotItems("status-left")[0]).toBe("clock");
  });

  it("toggleMenuBar and toggleStatusBar flip persisted booleans", async () => {
    await seedDefaultProfile();
    const store = useChromeStore();
    await store.loadProfiles();
    await store.toggleMenuBar();
    expect(store.menuBarVisible).toBe(false);
    await store.toggleStatusBar();
    expect(store.statusBarVisible).toBe(false);
  });

  it("createProfile + setDefaultProfile + deleteProfile manage profile list", async () => {
    await seedDefaultProfile();
    const store = useChromeStore();
    await store.loadProfiles();
    const compact = await store.createProfile("Compact");
    expect(store.profiles.length).toBe(2);
    await store.setDefaultProfile(compact.id);
    expect(store.profiles.find((p) => p.id === compact.id)?.isDefault).toBe(true);
    // delete the now-non-default profile (cannot delete the default)
    const previousDefault = store.profiles.find((p) => p.id !== compact.id);
    expect(previousDefault).toBeDefined();
    await store.deleteProfile(previousDefault!.id);
    expect(store.profiles.length).toBe(1);
  });
});
