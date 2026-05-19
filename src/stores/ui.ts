import { defineStore } from "pinia";
import { ref } from "vue";

export type AppMode = "3d" | "2d" | "split";

/**
 * UI store — tracks app-wide chrome state (current map mode, sidebar
 * visibility, command-palette state). Does NOT hold the Dockview layout —
 * that lives in `useLayoutStore` because of its idb persistence lifecycle.
 */
export const useUiStore = defineStore("ui", () => {
  const mode = ref<AppMode>("3d");
  const sidebarVisible = ref(true);
  const commandPaletteOpen = ref(false);

  function setMode(next: AppMode) {
    mode.value = next;
  }

  function toggleSidebar() {
    sidebarVisible.value = !sidebarVisible.value;
  }

  function openCommandPalette() {
    commandPaletteOpen.value = true;
  }

  function closeCommandPalette() {
    commandPaletteOpen.value = false;
  }

  return {
    mode,
    sidebarVisible,
    commandPaletteOpen,
    setMode,
    toggleSidebar,
    openCommandPalette,
    closeCommandPalette,
  };
});
