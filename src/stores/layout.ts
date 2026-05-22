import type { CreateLayoutInput, UpdateLayoutInput } from "@/modules/storage/layoutRepo";
import type { Layout, Ulid } from "@/types/workspace";

import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";

import { appMetaRepo } from "@/modules/storage/appMetaRepo";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";

const CURRENT_LAYOUT_KEY = "current-layout-id";

/**
 * Layout store — owns the layouts of the currently-active workspace, plus
 * the "currently active layout" pointer. The store is reloaded whenever
 * the active workspace changes (`loadForWorkspace`).
 *
 * Note: the **active layout's live Dockview state** is owned by the session
 * store (`useSessionStore`), not here. This store deals only with persisted
 * Layout records.
 */
export const useLayoutStore = defineStore("layout", () => {
  const layouts = shallowRef<Layout[]>([]);
  const currentLayoutId = ref<null | Ulid>(null);
  const currentWorkspaceId = ref<null | Ulid>(null);

  const currentLayout = computed<Layout | null>(
    () => layouts.value.find((l) => l.id === currentLayoutId.value) ?? null,
  );

  const layoutsForWorkspace = computed<Layout[]>(() => layouts.value);

  const defaultLayoutForCurrentWorkspace = computed<Layout | null>(() => {
    if (!currentWorkspaceId.value) return null;
    return layouts.value[0] ?? null;
  });

  async function loadForWorkspace(workspaceId: Ulid): Promise<void> {
    currentWorkspaceId.value = workspaceId;
    layouts.value = await layoutRepo.listByWorkspace(workspaceId);

    const workspace = await workspaceRepo.getById(workspaceId);
    const persisted = await appMetaRepo.get<Ulid>(CURRENT_LAYOUT_KEY);
    const persistedMatches = persisted && layouts.value.some((l) => l.id === persisted);

    if (persistedMatches) {
      currentLayoutId.value = persisted!;
    } else if (
      workspace?.defaultLayoutId &&
      layouts.value.some((l) => l.id === workspace.defaultLayoutId)
    ) {
      currentLayoutId.value = workspace.defaultLayoutId;
    } else {
      currentLayoutId.value = layouts.value[0]?.id ?? null;
    }
    if (currentLayoutId.value) {
      await appMetaRepo.set(CURRENT_LAYOUT_KEY, currentLayoutId.value);
    }
  }

  async function createLayout(input: CreateLayoutInput): Promise<Layout> {
    const layout = await layoutRepo.create(input);
    if (input.workspaceId === currentWorkspaceId.value) {
      layouts.value = await layoutRepo.listByWorkspace(input.workspaceId);
    }
    return layout;
  }

  async function renameLayout(id: Ulid, patch: UpdateLayoutInput): Promise<Layout> {
    const updated = await layoutRepo.update(id, patch);
    if (currentWorkspaceId.value) {
      layouts.value = await layoutRepo.listByWorkspace(currentWorkspaceId.value);
    }
    return updated;
  }

  async function setDefaultForWorkspace(workspaceId: Ulid, layoutId: Ulid): Promise<void> {
    await workspaceRepo.update(workspaceId, { defaultLayoutId: layoutId });
  }

  async function deleteLayout(id: Ulid): Promise<void> {
    await layoutRepo.delete(id);
    if (currentWorkspaceId.value) {
      layouts.value = await layoutRepo.listByWorkspace(currentWorkspaceId.value);
    }
    if (currentLayoutId.value === id) {
      currentLayoutId.value = layouts.value[0]?.id ?? null;
      if (currentLayoutId.value) {
        await appMetaRepo.set(CURRENT_LAYOUT_KEY, currentLayoutId.value);
      } else {
        await appMetaRepo.delete(CURRENT_LAYOUT_KEY);
      }
    }
  }

  async function duplicateLayout(id: Ulid, opts: { name?: string } = {}): Promise<Layout> {
    const dup = await layoutRepo.duplicate(id, opts);
    if (currentWorkspaceId.value) {
      layouts.value = await layoutRepo.listByWorkspace(currentWorkspaceId.value);
    }
    return dup;
  }

  async function setCurrentLayout(id: Ulid): Promise<void> {
    if (!layouts.value.some((l) => l.id === id)) {
      throw new Error(`Layout not loaded in current workspace: ${id}`);
    }
    currentLayoutId.value = id;
    await appMetaRepo.set(CURRENT_LAYOUT_KEY, id);
  }

  return {
    layouts,
    currentLayoutId,
    currentLayout,
    layoutsForWorkspace,
    defaultLayoutForCurrentWorkspace,
    loadForWorkspace,
    createLayout,
    renameLayout,
    setDefaultForWorkspace,
    deleteLayout,
    duplicateLayout,
    setCurrentLayout,
  };
});
