import { createPinia, setActivePinia } from "pinia";

import { resetStorage } from "../storage/helpers";

/**
 * Per-test reset for store specs: wipe IndexedDB and install a fresh
 * Pinia instance. Call from `beforeEach`.
 */
export async function resetForStoreTest(): Promise<void> {
  await resetStorage();
  setActivePinia(createPinia());
}
