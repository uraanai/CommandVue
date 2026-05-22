import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "@/modules/storage/workspaceRepo";
import type { Ulid, Workspace } from "@/types/workspace";

import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";

import { appMetaRepo } from "@/modules/storage/appMetaRepo";
import { workspaceRepo } from "@/modules/storage/workspaceRepo";

const CURRENT_WORKSPACE_KEY = "current-workspace-id";

/**
 * Workspace store — owns the list of workspaces and the "currently active"
 * pointer. Backed by `workspaceRepo`; this store never touches IndexedDB
 * directly. UI components and other stores read from here.
 *
 * Lifecycle: `loadAll()` must run once at app start before any view
 * renders the dock. `main.ts` does this after `seedIfEmpty()`.
 */
export const useWorkspaceStore = defineStore("workspace", () => {
  const workspaces = shallowRef<Workspace[]>([]);
  const currentWorkspaceId = ref<null | Ulid>(null);
  const ready = ref(false);

  const currentWorkspace = computed<null | Workspace>(() => {
    if (!currentWorkspaceId.value) return null;
    return workspaces.value.find((w) => w.id === currentWorkspaceId.value) ?? null;
  });

  const globalDefault = computed<null | Workspace>(
    () => workspaces.value.find((w) => w.isGlobalDefault) ?? null,
  );

  function workspaceById(id: Ulid): undefined | Workspace {
    return workspaces.value.find((w) => w.id === id);
  }

  async function loadAll(): Promise<void> {
    workspaces.value = await workspaceRepo.list();
    const persisted = await appMetaRepo.get<Ulid>(CURRENT_WORKSPACE_KEY);
    if (persisted && workspaces.value.some((w) => w.id === persisted)) {
      currentWorkspaceId.value = persisted;
    } else {
      currentWorkspaceId.value = globalDefault.value?.id ?? workspaces.value[0]?.id ?? null;
      if (currentWorkspaceId.value) {
        await appMetaRepo.set(CURRENT_WORKSPACE_KEY, currentWorkspaceId.value);
      }
    }
    ready.value = true;
  }

  async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    const ws = await workspaceRepo.create(input);
    workspaces.value = await workspaceRepo.list();
    return ws;
  }

  async function renameWorkspace(id: Ulid, patch: UpdateWorkspaceInput): Promise<Workspace> {
    const updated = await workspaceRepo.update(id, patch);
    workspaces.value = await workspaceRepo.list();
    return updated;
  }

  async function setGlobalDefault(id: Ulid): Promise<void> {
    await workspaceRepo.setGlobalDefault(id);
    workspaces.value = await workspaceRepo.list();
  }

  async function setCurrentWorkspace(id: Ulid): Promise<void> {
    if (!workspaces.value.some((w) => w.id === id)) {
      throw new Error(`Workspace not loaded: ${id}`);
    }
    currentWorkspaceId.value = id;
    await appMetaRepo.set(CURRENT_WORKSPACE_KEY, id);
  }

  async function deleteWorkspace(id: Ulid): Promise<void> {
    await workspaceRepo.delete(id);
    workspaces.value = await workspaceRepo.list();
    if (currentWorkspaceId.value === id) {
      currentWorkspaceId.value = globalDefault.value?.id ?? workspaces.value[0]?.id ?? null;
      if (currentWorkspaceId.value) {
        await appMetaRepo.set(CURRENT_WORKSPACE_KEY, currentWorkspaceId.value);
      }
    }
  }

  return {
    workspaces,
    currentWorkspaceId,
    ready,
    currentWorkspace,
    globalDefault,
    workspaceById,
    loadAll,
    createWorkspace,
    renameWorkspace,
    setGlobalDefault,
    setCurrentWorkspace,
    deleteWorkspace,
  };
});
