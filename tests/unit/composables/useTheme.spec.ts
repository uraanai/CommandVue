import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initializeTheme, teardownTheme, useTheme } from "@/composables/useTheme";
import { appMetaRepo } from "@/modules/storage/appMetaRepo";

import { resetStorage } from "../storage/helpers";

const STORAGE_KEY = "commandvue:theme";

interface FakeMql {
  matches: boolean;
  media: string;
  addEventListener(type: "change", listener: (e: { matches: boolean }) => void): void;
  removeEventListener(type: "change", listener: (e: { matches: boolean }) => void): void;
  fireChange(matches: boolean): void;
}

function installMatchMedia(initialMatches: boolean): FakeMql {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql: FakeMql = {
    matches: initialMatches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
    fireChange(matches) {
      this.matches = matches;
      for (const listener of listeners) listener({ matches });
    },
  };
  vi.stubGlobal("matchMedia", () => mql);
  return mql;
}

describe("useTheme", () => {
  beforeEach(async () => {
    await resetStorage();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    teardownTheme();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    teardownTheme();
  });

  it("defaults to auto mode when no value is persisted", async () => {
    installMatchMedia(false);
    await initializeTheme();
    const { mode } = useTheme();
    expect(mode.value).toBe("auto");
  });

  it("auto mode resolves to light when system prefers light", async () => {
    installMatchMedia(false);
    await initializeTheme();
    const { resolvedTheme } = useTheme();
    expect(resolvedTheme.value).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("auto mode resolves to dark when system prefers dark", async () => {
    installMatchMedia(true);
    await initializeTheme();
    const { resolvedTheme } = useTheme();
    expect(resolvedTheme.value).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("setMode('dark') applies and persists", async () => {
    installMatchMedia(false);
    await initializeTheme();
    const { mode, resolvedTheme, setMode } = useTheme();
    await setMode("dark");
    expect(mode.value).toBe("dark");
    expect(resolvedTheme.value).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(await appMetaRepo.get(STORAGE_KEY)).toBe("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("setMode('light') overrides a dark default", async () => {
    installMatchMedia(true);
    await initializeTheme();
    const { setMode, resolvedTheme } = useTheme();
    expect(resolvedTheme.value).toBe("dark");
    await setMode("light");
    expect(resolvedTheme.value).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("cycleMode advances light → dark → auto → light", async () => {
    installMatchMedia(false);
    await initializeTheme();
    const { mode, setMode, cycleMode } = useTheme();
    await setMode("light");
    expect(mode.value).toBe("light");

    await cycleMode();
    expect(mode.value).toBe("dark");

    await cycleMode();
    expect(mode.value).toBe("auto");

    await cycleMode();
    expect(mode.value).toBe("light");
  });

  it("nextModeLabel describes the next step in the cycle", async () => {
    installMatchMedia(false);
    await initializeTheme();
    const { setMode, nextModeLabel } = useTheme();
    await setMode("light");
    expect(nextModeLabel.value).toBe("Dark");
    await setMode("dark");
    expect(nextModeLabel.value).toBe("Auto (system)");
    await setMode("auto");
    expect(nextModeLabel.value).toBe("Light");
  });

  it("re-resolves auto mode when the system preference changes", async () => {
    const mql = installMatchMedia(false);
    await initializeTheme();
    const { mode, resolvedTheme } = useTheme();
    expect(mode.value).toBe("auto");
    expect(resolvedTheme.value).toBe("light");

    mql.fireChange(true);
    expect(resolvedTheme.value).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    mql.fireChange(false);
    expect(resolvedTheme.value).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("does not flip resolvedTheme when system changes during explicit modes", async () => {
    const mql = installMatchMedia(false);
    await initializeTheme();
    const { setMode, resolvedTheme } = useTheme();
    await setMode("light");
    expect(resolvedTheme.value).toBe("light");

    mql.fireChange(true);
    expect(resolvedTheme.value).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("hydrates from appMetaRepo on initialize", async () => {
    installMatchMedia(false);
    await appMetaRepo.set(STORAGE_KEY, "dark");
    await initializeTheme();
    const { mode, resolvedTheme } = useTheme();
    expect(mode.value).toBe("dark");
    expect(resolvedTheme.value).toBe("dark");
  });

  it("mirrors the resolved theme to localStorage (anti-FOUC)", async () => {
    installMatchMedia(false);
    await initializeTheme();
    const { setMode } = useTheme();
    await setMode("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    await setMode("light");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("creates a polite aria-live region on first mode change", async () => {
    installMatchMedia(false);
    await initializeTheme();
    const { setMode } = useTheme();
    await setMode("dark");
    const region = document.getElementById("commandvue-theme-announce");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.getAttribute("role")).toBe("status");
  });

  it("initializeTheme is idempotent", async () => {
    installMatchMedia(false);
    await initializeTheme();
    await initializeTheme();
    await initializeTheme();
    const { mode } = useTheme();
    expect(mode.value).toBe("auto");
  });
});
