import type { Theme, ThemeId } from "@/types/theme";
import type { Ulid } from "@/types/workspace";

import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { appMetaRepo } from "@/modules/storage/appMetaRepo";
import { applyTheme } from "@/modules/themes/apply";
import { themeRegistry } from "@/modules/themes/registry";

/**
 * Theme store (Phase 3.3).
 *
 * Owns the *user's choice* of theme — the registry owns which themes exist.
 * The composable `useTheme()` from Phase 3.2 still owns the `data-theme`
 * mode (light/dark/auto) and the matchMedia listener; this store layers on
 * top to handle theme-variant selection and per-workspace binding.
 *
 * Precedence (highest wins):
 *   1. Workspace-bound theme (key: `commandvue:workspace-theme-{wsId}`)
 *   2. Global theme pointer    (key: `commandvue:theme-id`)
 *   3. Fallback                — `compact-light`
 *
 * Persistence is IDB (`appMetaRepo`). No localStorage mirror — the
 * anti-FOUC inline script in `index.html` only needs the resolved
 * light/dark value, which `useTheme` still mirrors separately.
 */

const GLOBAL_THEME_KEY = "commandvue:theme-id";
const WORKSPACE_THEME_KEY_PREFIX = "commandvue:workspace-theme-";
const FALLBACK_THEME_ID: ThemeId = "compact-light";

function workspaceThemeKey(workspaceId: Ulid): string {
  return `${WORKSPACE_THEME_KEY_PREFIX}${workspaceId}`;
}

export const useThemeStore = defineStore("theme", () => {
  const currentThemeId = ref<ThemeId | null>(null);
  // Cache of per-workspace bindings loaded in this session. Indexed by
  // workspace id. Empty string sentinel means "explicitly unbound" so the UI
  // can tell apart "no binding loaded yet" from "binding loaded as null".
  const workspaceBindings = ref<Record<Ulid, ThemeId | null>>({});

  const currentTheme = computed<Theme | null>(() => {
    if (!currentThemeId.value) return null;
    return themeRegistry.get(currentThemeId.value) ?? null;
  });

  /**
   * Resolve which theme should be active for the given workspace. The pure
   * function is exported for tests; the store version reads from
   * `appMetaRepo` first time round.
   */
  async function resolveForWorkspace(workspaceId: Ulid | null): Promise<ThemeId> {
    if (workspaceId) {
      const bound = await appMetaRepo.get<ThemeId>(workspaceThemeKey(workspaceId));
      if (bound && themeRegistry.get(bound)) {
        workspaceBindings.value = { ...workspaceBindings.value, [workspaceId]: bound };
        return bound;
      }
      // Cache "no binding" so the UI can short-circuit.
      workspaceBindings.value = { ...workspaceBindings.value, [workspaceId]: null };
    }
    const global = await appMetaRepo.get<ThemeId>(GLOBAL_THEME_KEY);
    if (global && themeRegistry.get(global)) return global;
    return FALLBACK_THEME_ID;
  }

  /**
   * Load and apply the theme for the given workspace (or the global default
   * if no workspace is active). Call from the app boot sequence after the
   * theme registry is populated AND the workspace store has resolved its
   * current id. Also call from any workspace-switch flow.
   */
  async function loadInitial(workspaceId: Ulid | null): Promise<void> {
    const id = await resolveForWorkspace(workspaceId);
    const theme = themeRegistry.get(id);
    if (!theme) {
      // Registry empty or theme missing — fall back to whatever's first.
      const first = themeRegistry.list()[0];
      if (first) {
        currentThemeId.value = first.id;
        applyTheme(first);
      }
      return;
    }
    currentThemeId.value = id;
    applyTheme(theme);
  }

  /**
   * Set the global theme. Persists to `appMetaRepo` and applies immediately
   * unless a workspace binding takes precedence (in which case the
   * workspace-bound theme stays active and the global write is queued for
   * the next non-bound workspace).
   */
  async function setTheme(themeId: ThemeId, workspaceId: Ulid | null = null): Promise<void> {
    const theme = themeRegistry.get(themeId);
    if (!theme) throw new Error(`Unknown theme: ${themeId}`);
    await appMetaRepo.set(GLOBAL_THEME_KEY, themeId);
    // If the current workspace has a binding, the binding wins — don't
    // apply, but the next workspace switch (or a clearWorkspaceTheme call)
    // will pick this up.
    if (workspaceId && workspaceBindings.value[workspaceId]) return;
    currentThemeId.value = themeId;
    applyTheme(theme);
  }

  /**
   * Bind a theme to a workspace. Persists + immediately applies if the bound
   * workspace is the active one.
   */
  async function setWorkspaceTheme(
    workspaceId: Ulid,
    themeId: ThemeId,
    activeWorkspaceId: Ulid | null = workspaceId,
  ): Promise<void> {
    const theme = themeRegistry.get(themeId);
    if (!theme) throw new Error(`Unknown theme: ${themeId}`);
    await appMetaRepo.set(workspaceThemeKey(workspaceId), themeId);
    workspaceBindings.value = { ...workspaceBindings.value, [workspaceId]: themeId };
    if (workspaceId === activeWorkspaceId) {
      currentThemeId.value = themeId;
      applyTheme(theme);
    }
  }

  /**
   * Remove a workspace's theme binding. If the workspace is currently
   * active, re-resolves against the global pointer.
   */
  async function clearWorkspaceTheme(
    workspaceId: Ulid,
    activeWorkspaceId: Ulid | null = workspaceId,
  ): Promise<void> {
    await appMetaRepo.delete(workspaceThemeKey(workspaceId));
    workspaceBindings.value = { ...workspaceBindings.value, [workspaceId]: null };
    if (workspaceId === activeWorkspaceId) {
      await loadInitial(workspaceId);
    }
  }

  /**
   * Read a workspace's binding from the cache. Returns `undefined` when no
   * binding has been loaded yet for that workspace (caller should call
   * `resolveForWorkspace` to hydrate).
   */
  function getWorkspaceBinding(workspaceId: Ulid): ThemeId | null | undefined {
    return workspaceBindings.value[workspaceId];
  }

  return {
    currentThemeId,
    currentTheme,
    workspaceBindings,
    resolveForWorkspace,
    loadInitial,
    setTheme,
    setWorkspaceTheme,
    clearWorkspaceTheme,
    getWorkspaceBinding,
  };
});
