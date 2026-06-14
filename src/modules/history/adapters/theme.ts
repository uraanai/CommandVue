import type { Command } from "../types";
import type { ThemeId } from "@/types/theme";
import type { Ulid } from "@/types/workspace";

import { appMetaRepo } from "@/modules/storage/appMetaRepo";
import { useThemeStore } from "@/stores/theme";

import { makeCommand } from "../factories";

/** app-meta key prefix for a workspace's bound theme (mirrors theme.ts). */
const WORKSPACE_THEME_KEY_PREFIX = "commandvue:workspace-theme-";

/**
 * Undoable global theme commit. Captures the prior global theme id and restores
 * it on undo. Only the *committed* theme pointer is undoable — the live preview
 * path (begin/setPreviewToken/cancelPreview) writes transient inline styles and
 * is intentionally never recorded.
 */
export function makeSetThemeCommand(themeId: ThemeId, workspaceId: Ulid | null = null): Command {
  const theme = useThemeStore();
  let priorThemeId: null | ThemeId = null;
  return makeCommand({
    label: "Change theme",
    scope: "theme",
    category: "commit",
    coalesceKey: "theme-global",
    async redo() {
      priorThemeId = theme.currentThemeId;
      await theme.setTheme(themeId, workspaceId);
    },
    async undo() {
      if (priorThemeId) await theme.setTheme(priorThemeId, workspaceId);
    },
  });
}

/**
 * Undoable per-workspace theme binding. Captures the prior binding (if any) and
 * restores it on undo — or clears the binding if there was none.
 */
export function makeSetWorkspaceThemeCommand(
  workspaceId: Ulid,
  themeId: ThemeId,
  activeWorkspaceId: Ulid | null = null,
): Command {
  const theme = useThemeStore();
  let priorBinding: null | ThemeId = null;
  return makeCommand({
    label: "Set workspace theme",
    scope: "theme",
    category: "commit",
    async redo() {
      priorBinding =
        (await appMetaRepo.get<ThemeId>(`${WORKSPACE_THEME_KEY_PREFIX}${workspaceId}`)) ?? null;
      await theme.setWorkspaceTheme(workspaceId, themeId, activeWorkspaceId);
    },
    async undo() {
      if (priorBinding) {
        await theme.setWorkspaceTheme(workspaceId, priorBinding, activeWorkspaceId);
      } else {
        await theme.clearWorkspaceTheme(workspaceId, activeWorkspaceId);
      }
    },
  });
}
