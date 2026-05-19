import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useUiStore } from "@/stores/ui";

describe("ui store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts in 3d mode with sidebar visible and palette closed", () => {
    const store = useUiStore();
    expect(store.mode).toBe("3d");
    expect(store.sidebarVisible).toBe(true);
    expect(store.commandPaletteOpen).toBe(false);
  });

  it("setMode() switches between 3d / 2d / split", () => {
    const store = useUiStore();
    store.setMode("2d");
    expect(store.mode).toBe("2d");
    store.setMode("split");
    expect(store.mode).toBe("split");
  });

  it("toggleSidebar() flips visibility", () => {
    const store = useUiStore();
    store.toggleSidebar();
    expect(store.sidebarVisible).toBe(false);
    store.toggleSidebar();
    expect(store.sidebarVisible).toBe(true);
  });

  it("openCommandPalette / closeCommandPalette toggle the palette", () => {
    const store = useUiStore();
    store.openCommandPalette();
    expect(store.commandPaletteOpen).toBe(true);
    store.closeCommandPalette();
    expect(store.commandPaletteOpen).toBe(false);
  });
});
