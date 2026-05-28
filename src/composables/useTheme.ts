import { computed, readonly, ref, type Ref } from "vue";

import { appMetaRepo } from "@/modules/storage/appMetaRepo";
import { themeRegistry } from "@/modules/themes/registry";

/**
 * Three-way theme composable (Phase 3.2 of Prompt 3).
 *
 * Modes:
 *   - "light" — explicit light mode
 *   - "dark"  — explicit dark mode
 *   - "auto"  — follow OS `prefers-color-scheme` (default)
 *
 * Resolution: the active visual theme (`resolvedTheme`) is always `"light"` or
 * `"dark"`. Auto mode resolves via `matchMedia('(prefers-color-scheme: dark)')`
 * and re-resolves automatically when the OS preference changes.
 *
 * Persistence is dual-write:
 *   - `appMetaRepo` (IndexedDB) is the **authority**. Survives across browser
 *     profiles; cascades cleanly when the future Supabase migration moves the
 *     key/value store to Postgres.
 *   - `localStorage` is a **synchronous mirror** read by the anti-FOUC inline
 *     script in `index.html` BEFORE any CSS loads. Without it, the page would
 *     flash light on first paint even for users who chose dark. IDB is async,
 *     so we can't read it pre-mount.
 *
 * Initialization: call `initializeTheme()` once from `main.ts` before
 * `app.mount()`. That hydrates the in-memory `mode` ref from IDB (in case the
 * localStorage mirror was cleared or stale) and wires the matchMedia listener.
 *
 * Components consume `useTheme()` to read `mode` / `resolvedTheme`, call
 * `setMode(next)` to switch, or `cycleMode()` to advance light → dark → auto →
 * light. `aria-live` announcements fire via the singleton helper exposed below.
 *
 * The `data-theme` attribute on `<html>` is the source of truth for CSS. The
 * `dark:` Tailwind variant (`@custom-variant dark` in `main.css`) and the
 * `html[data-theme="dark"]` overrides in `tokens.css` both key off this
 * attribute.
 */

export type ThemeMode = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "commandvue:theme";

// Module-level singletons. `useTheme()` returns refs to these so multiple
// component instances see the same state and re-renders stay in sync.
const mode = ref<ThemeMode>("auto");
const systemPrefersDark = ref(false);

let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;
let initialized = false;

/**
 * Resolve a mode against the current system preference.
 * Pure function — caller passes the system signal explicitly.
 */
function resolveMode(m: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (m === "auto") return systemDark ? "dark" : "light";
  return m;
}

/**
 * Apply a resolved theme to the DOM and mirror to localStorage so the next
 * page load can avoid a flash. The mirror stores the resolved theme (light or
 * dark), not the mode, because the anti-FOUC script can't compute auto
 * resolution synchronously before CSS loads — it needs the actual value to
 * paint.
 *
 * After setting `data-theme`, the variant bridge looks up the paired theme
 * for the current active theme id (e.g. `compact-light` ↔ `compact-dark`)
 * and applies it if found. The bridge lets the Light / Dark / Auto toggle
 * carry the user's chosen aesthetic across mode changes — switching modes
 * doesn't drop them back to the default theme.
 */
function applyResolved(resolved: ResolvedTheme): void {
  const html = document.documentElement;
  html.setAttribute("data-theme", resolved);
  try {
    localStorage.setItem(STORAGE_KEY, resolved);
  } catch {
    // localStorage can throw in private-mode Safari or with disabled storage.
    // Persistence falls back to IDB; the only loss is anti-FOUC on next load.
  }
  bridgeVariant(resolved);
}

/**
 * If the currently-applied theme has a paired variant for the resolved mode,
 * swap to it. Precedence (Prompt 4 Phase F):
 *
 *   1. **`generation.paired`** — generated themes (Phase B/E) carry an
 *      explicit cross-link to their opposite-mode counterpart. If the paired
 *      theme's `mode` matches the resolved mode, swap to it. This works
 *      regardless of theme name / id format (the customizer generates ULIDs,
 *      not suffix conventions).
 *
 *   2. **`-light` / `-dark` suffix swap** — bundled built-ins follow the
 *      `compact-light` ↔ `compact-dark` naming convention. If the current
 *      id has the opposite-mode suffix and the paired id exists, swap.
 *
 *   3. **No-op** — if neither path produces a paired theme. The `data-theme`
 *      attribute is still flipped by `applyResolved` above so dark-mode CSS
 *      rules (`html[data-theme="dark"]` overrides in `tokens.css`) take
 *      effect, just without losing the chosen aesthetic.
 *
 * Dynamically imports the theme store to avoid a circular dependency
 * (themeStore → applyTheme; useTheme → themeStore). The import is cached
 * after first call.
 */
let cachedThemeStore: { setTheme: (id: string) => Promise<void> } | null = null;

async function applyPairedTheme(pairedId: string): Promise<void> {
  if (!cachedThemeStore) {
    const mod = await import("@/stores/theme");
    cachedThemeStore = mod.useThemeStore();
  }
  await cachedThemeStore.setTheme(pairedId);
}

function bridgeVariant(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  const currentId = root.getAttribute("data-theme-id");
  if (!currentId) return;
  const currentTheme = themeRegistry.get(currentId);
  if (!currentTheme) return;
  // Current theme already on the right side — nothing to bridge.
  if (currentTheme.mode === resolved) return;

  // 1. Generated themes: explicit cross-link via generation.paired.
  const pairedId = currentTheme.generation?.paired;
  if (pairedId) {
    const paired = themeRegistry.get(pairedId);
    if (paired && paired.mode === resolved) {
      void applyPairedTheme(pairedId);
      return;
    }
  }

  // 2. Built-ins: -light / -dark suffix swap.
  const otherSuffix: "-light" | "-dark" = resolved === "dark" ? "-dark" : "-light";
  const oppositeSuffix: "-light" | "-dark" = resolved === "dark" ? "-light" : "-dark";
  if (currentId.endsWith(oppositeSuffix)) {
    const baseId = currentId.slice(0, -oppositeSuffix.length);
    const suffixPairedId = `${baseId}${otherSuffix}`;
    const suffixPaired = themeRegistry.get(suffixPairedId);
    if (suffixPaired) {
      void applyPairedTheme(suffixPairedId);
      return;
    }
  }
  // 3. Graceful no-op — data-theme already flipped by caller.
}

/**
 * Push an announcement to a polite aria-live region so screen-reader users
 * know the theme changed. The region is created on first call and reused.
 */
function announce(message: string): void {
  let region = document.getElementById("commandvue-theme-announce");
  if (!region) {
    region = document.createElement("div");
    region.id = "commandvue-theme-announce";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.style.position = "absolute";
    region.style.width = "1px";
    region.style.height = "1px";
    region.style.padding = "0";
    region.style.margin = "-1px";
    region.style.overflow = "hidden";
    region.style.clip = "rect(0, 0, 0, 0)";
    region.style.whiteSpace = "nowrap";
    region.style.border = "0";
    document.body.appendChild(region);
  }
  // Clear and re-set so the same message twice in a row still announces.
  region.textContent = "";
  setTimeout(() => {
    if (region) region.textContent = message;
  }, 50);
}

/**
 * Persist the chosen mode to IDB. The localStorage mirror happens in
 * `applyResolved` because it stores the *resolved* theme, not the *mode*.
 */
async function persistMode(next: ThemeMode): Promise<void> {
  try {
    await appMetaRepo.set(STORAGE_KEY, next);
  } catch (err) {
    console.warn("[useTheme] failed to persist mode to IDB", err);
  }
}

/**
 * Read the persisted mode from IDB. Falls back to `"auto"` when missing or
 * unreadable. Called once from `initializeTheme()`.
 */
async function loadPersistedMode(): Promise<ThemeMode> {
  try {
    const v = await appMetaRepo.get<ThemeMode>(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch (err) {
    console.warn("[useTheme] failed to read mode from IDB", err);
  }
  return "auto";
}

/**
 * One-time bootstrap. Call from `main.ts` before `app.mount()`.
 *
 *   1. Load the persisted mode from IDB (authoritative).
 *   2. Wire a matchMedia listener so auto mode tracks OS changes live.
 *   3. Apply the resolved theme to the DOM (sets data-theme + mirrors to
 *      localStorage for the next FOUC-free paint).
 *
 * Idempotent — re-invocation is a no-op.
 */
export async function initializeTheme(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemPrefersDark.value = mediaQuery.matches;
    mediaListener = (e) => {
      systemPrefersDark.value = e.matches;
      if (mode.value === "auto") applyResolved(resolveMode("auto", e.matches));
    };
    mediaQuery.addEventListener("change", mediaListener);
  }

  mode.value = await loadPersistedMode();
  applyResolved(resolveMode(mode.value, systemPrefersDark.value));
}

/** Tear down the matchMedia listener. Useful in tests. */
export function teardownTheme(): void {
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener("change", mediaListener);
  }
  mediaQuery = null;
  mediaListener = null;
  initialized = false;
  mode.value = "auto";
  systemPrefersDark.value = false;
}

const MODE_LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  auto: "Auto (system)",
};

/**
 * Public composable. Returns reactive state + actions.
 *
 *   - `mode`           — current chosen mode (readonly Ref<ThemeMode>)
 *   - `resolvedTheme`  — actual rendered theme (computed)
 *   - `systemPrefersDark` — readonly Ref reflecting the matchMedia signal
 *   - `setMode(next)`  — switch to a specific mode (announces, persists, applies)
 *   - `cycleMode()`    — advance light → dark → auto → light
 *   - `nextModeLabel`  — computed label for the "next" mode in the cycle
 *
 * Backwards-compatible aliases:
 *   - `isDark`  — Ref<boolean> tied to `resolvedTheme === "dark"`
 *   - `toggle()` — calls `cycleMode()`
 */
export function useTheme(): {
  mode: Readonly<Ref<ThemeMode>>;
  resolvedTheme: Readonly<Ref<ResolvedTheme>>;
  systemPrefersDark: Readonly<Ref<boolean>>;
  isDark: Readonly<Ref<boolean>>;
  setMode: (next: ThemeMode) => Promise<void>;
  cycleMode: () => Promise<void>;
  nextModeLabel: Readonly<Ref<string>>;
  toggle: () => Promise<void>;
} {
  const resolvedTheme = computed<ResolvedTheme>(() =>
    resolveMode(mode.value, systemPrefersDark.value),
  );
  const isDark = computed(() => resolvedTheme.value === "dark");

  async function setMode(next: ThemeMode): Promise<void> {
    if (mode.value === next) return;
    mode.value = next;
    await persistMode(next);
    applyResolved(resolveMode(next, systemPrefersDark.value));
    announce(`Theme: ${MODE_LABELS[next]}`);
  }

  async function cycleMode(): Promise<void> {
    const order: ThemeMode[] = ["light", "dark", "auto"];
    const i = order.indexOf(mode.value);
    const next = order[(i + 1) % order.length] ?? "light";
    await setMode(next);
  }

  const nextModeLabel = computed(() => {
    const order: ThemeMode[] = ["light", "dark", "auto"];
    const i = order.indexOf(mode.value);
    const next = order[(i + 1) % order.length] ?? "light";
    return MODE_LABELS[next];
  });

  return {
    mode: readonly(mode),
    resolvedTheme: readonly(resolvedTheme),
    systemPrefersDark: readonly(systemPrefersDark),
    isDark: readonly(isDark),
    setMode,
    cycleMode,
    nextModeLabel: readonly(nextModeLabel),
    toggle: cycleMode,
  };
}
