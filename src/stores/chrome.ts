import type { ChromeItemId, ChromeProfile, ChromeSlot } from "@/types/chrome";
import type { Ulid } from "@/types/workspace";

import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";

import { chromeProfileRepo } from "@/modules/storage/chromeProfileRepo";
import { CHROME_SLOTS } from "@/types/chrome";

/**
 * Chrome store — owns the chrome-profile list, the active profile pointer,
 * and the runtime edit-mode flag.
 *
 * The `canEdit` computed always returns `true` in Phase E — auth lands later.
 * Downstream apps that wire authentication should replace this computed with
 * their own permission check (e.g. read from a session store).
 */
export const useChromeStore = defineStore("chrome", () => {
  const profiles = shallowRef<ChromeProfile[]>([]);
  const currentProfileId = ref<null | Ulid>(null);
  const editMode = ref(false);

  const currentProfile = computed<ChromeProfile | null>(
    () => profiles.value.find((p) => p.id === currentProfileId.value) ?? null,
  );

  const canEdit = computed(() => true);

  const menuBarVisible = computed(() => currentProfile.value?.menuBarVisible ?? true);
  const statusBarVisible = computed(() => currentProfile.value?.statusBarVisible ?? true);

  function slotItems(slot: ChromeSlot): ChromeItemId[] {
    return currentProfile.value?.slotAssignments[slot] ?? [];
  }

  function isVisible(itemId: ChromeItemId): boolean {
    const profile = currentProfile.value;
    if (!profile) return false;
    if (profile.hiddenItems.includes(itemId)) return false;
    return Object.values(profile.slotAssignments).some((list) => list.includes(itemId));
  }

  async function loadProfiles(): Promise<void> {
    profiles.value = await chromeProfileRepo.list();
    const def = profiles.value.find((p) => p.isDefault);
    currentProfileId.value = def?.id ?? profiles.value[0]?.id ?? null;
    await ensureItemPresent("theme-toggle", "top-right");
  }

  /**
   * One-shot migration helper — used to add new built-in items to existing
   * chrome profiles that were seeded before the item existed. Idempotent: if
   * the item is already in any slot, this is a no-op.
   *
   * Called from `loadProfiles` so new built-ins land automatically without
   * requiring users to reset their chrome customization.
   */
  async function ensureItemPresent(itemId: ChromeItemId, slot: ChromeSlot): Promise<void> {
    for (const profile of profiles.value) {
      const present = Object.values(profile.slotAssignments).some((list) => list.includes(itemId));
      if (present) continue;
      const next: typeof profile.slotAssignments = { ...profile.slotAssignments };
      next[slot] = [...(next[slot] ?? []), itemId];
      await chromeProfileRepo.update(profile.id, { slotAssignments: next });
    }
    profiles.value = await chromeProfileRepo.list();
  }

  async function setCurrentProfile(id: Ulid): Promise<void> {
    if (!profiles.value.some((p) => p.id === id)) {
      throw new Error(`Chrome profile not loaded: ${id}`);
    }
    currentProfileId.value = id;
  }

  function enterEditMode(): void {
    if (canEdit.value) editMode.value = true;
  }

  function exitEditMode(): void {
    editMode.value = false;
  }

  function toggleEditMode(): void {
    if (editMode.value) {
      exitEditMode();
    } else {
      enterEditMode();
    }
  }

  async function persistCurrent(
    patch: Parameters<typeof chromeProfileRepo.update>[1],
  ): Promise<void> {
    const id = currentProfileId.value;
    if (!id) return;
    await chromeProfileRepo.update(id, patch);
    profiles.value = await chromeProfileRepo.list();
  }

  function freshSlotAssignments(profile: ChromeProfile): Record<ChromeSlot, ChromeItemId[]> {
    const out = {} as Record<ChromeSlot, ChromeItemId[]>;
    for (const slot of CHROME_SLOTS) out[slot] = [...(profile.slotAssignments[slot] ?? [])];
    return out;
  }

  async function addItemToSlot(
    itemId: ChromeItemId,
    slot: ChromeSlot,
    position?: number,
  ): Promise<void> {
    const profile = currentProfile.value;
    if (!profile) return;
    const slotAssignments = freshSlotAssignments(profile);
    // Remove from any other slot first (singleton rule across slots).
    for (const s of CHROME_SLOTS) {
      slotAssignments[s] = slotAssignments[s].filter((id) => id !== itemId);
    }
    const target = slotAssignments[slot];
    const insertAt = position ?? target.length;
    target.splice(insertAt, 0, itemId);
    const hiddenItems = profile.hiddenItems.filter((id) => id !== itemId);
    await persistCurrent({ slotAssignments, hiddenItems });
  }

  async function removeItemFromSlot(itemId: ChromeItemId, slot: ChromeSlot): Promise<void> {
    const profile = currentProfile.value;
    if (!profile) return;
    const slotAssignments = freshSlotAssignments(profile);
    slotAssignments[slot] = slotAssignments[slot].filter((id) => id !== itemId);
    const hiddenItems = profile.hiddenItems.includes(itemId)
      ? profile.hiddenItems
      : [...profile.hiddenItems, itemId];
    await persistCurrent({ slotAssignments, hiddenItems });
  }

  async function moveItem(
    itemId: ChromeItemId,
    fromSlot: ChromeSlot,
    toSlot: ChromeSlot,
    position?: number,
  ): Promise<void> {
    void fromSlot;
    // addItemToSlot already strips from any other slot — single call handles both
    // the within-slot reorder and the cross-slot move.
    await addItemToSlot(itemId, toSlot, position);
  }

  async function toggleMenuBar(): Promise<void> {
    const profile = currentProfile.value;
    if (!profile) return;
    await persistCurrent({ menuBarVisible: !profile.menuBarVisible });
  }

  async function toggleStatusBar(): Promise<void> {
    const profile = currentProfile.value;
    if (!profile) return;
    await persistCurrent({ statusBarVisible: !profile.statusBarVisible });
  }

  async function createProfile(name: string): Promise<ChromeProfile> {
    const created = await chromeProfileRepo.create({ name });
    profiles.value = await chromeProfileRepo.list();
    return created;
  }

  async function setDefaultProfile(id: Ulid): Promise<void> {
    await chromeProfileRepo.setDefault(id);
    profiles.value = await chromeProfileRepo.list();
  }

  async function deleteProfile(id: Ulid): Promise<void> {
    await chromeProfileRepo.delete(id);
    profiles.value = await chromeProfileRepo.list();
  }

  return {
    profiles,
    currentProfileId,
    currentProfile,
    editMode,
    canEdit,
    menuBarVisible,
    statusBarVisible,
    slotItems,
    isVisible,
    loadProfiles,
    setCurrentProfile,
    enterEditMode,
    exitEditMode,
    toggleEditMode,
    addItemToSlot,
    removeItemFromSlot,
    moveItem,
    toggleMenuBar,
    toggleStatusBar,
    createProfile,
    setDefaultProfile,
    deleteProfile,
  };
});
