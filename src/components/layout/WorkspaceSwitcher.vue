<script setup lang="ts">
import type { Ulid } from "@/types/workspace";

import { Check, ChevronDown, FolderCog, Plus } from "@lucide/vue";
import { onBeforeUnmount, ref } from "vue";

import ManageWorkspacesDialog from "@/components/dialogs/ManageWorkspacesDialog.vue";
import SaveLayoutAsDialog from "@/components/dialogs/SaveLayoutAsDialog.vue";
import UnsavedChangesDialog, {
  type UnsavedChoice,
} from "@/components/dialogs/UnsavedChangesDialog.vue";
import { useLayoutStore } from "@/stores/layout";
import { useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";

const workspace = useWorkspaceStore();
const layoutStore = useLayoutStore();
const session = useSessionStore();

const open = ref(false);
const manageOpen = ref(false);
const unsavedOpen = ref(false);
const saveAsOpen = ref(false);
const pendingWorkspaceId = ref<null | Ulid>(null);

function toggle(): void {
  open.value = !open.value;
}

function onClickOutside(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (!target.closest("[data-workspace-switcher]")) open.value = false;
}

window.addEventListener("click", onClickOutside);
onBeforeUnmount(() => window.removeEventListener("click", onClickOutside));

async function pickWorkspace(id: Ulid): Promise<void> {
  open.value = false;
  if (id === workspace.currentWorkspaceId) return;

  if (session.dirty) {
    pendingWorkspaceId.value = id;
    unsavedOpen.value = true;
    return;
  }
  await session.switchWorkspace(id);
}

async function resolveUnsaved(choice: UnsavedChoice): Promise<void> {
  const target = pendingWorkspaceId.value;
  pendingWorkspaceId.value = null;
  if (choice === "cancel" || !target) return;
  if (choice === "save") {
    await session.updateCurrentLayout();
    await session.switchWorkspace(target);
    return;
  }
  if (choice === "discard") {
    await session.discardChanges();
    await session.switchWorkspace(target);
    return;
  }
  if (choice === "save-as") {
    pendingWorkspaceId.value = target;
    saveAsOpen.value = true;
  }
}

async function onSaveAs(payload: {
  name: string;
  description?: string;
  setAsWorkspaceDefault: boolean;
}): Promise<void> {
  await session.saveCurrentAsNewLayout(payload);
  const target = pendingWorkspaceId.value;
  pendingWorkspaceId.value = null;
  if (target) await session.switchWorkspace(target);
}

function openManage(): void {
  open.value = false;
  manageOpen.value = true;
}
</script>

<template>
  <div data-workspace-switcher class="relative">
    <button
      type="button"
      class="text-muted hover:text-foreground hover:bg-surface-sunken flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors"
      @click="toggle"
    >
      <span class="text-foreground font-medium">
        {{ workspace.currentWorkspace?.name ?? "—" }}
      </span>
      <ChevronDown class="size-3.5" />
    </button>
    <div
      v-if="open"
      class="border-border bg-surface-raised absolute right-0 z-40 mt-1 w-56 rounded-md border py-1 shadow-lg"
    >
      <div class="text-faint px-3 py-1 text-[10px] tracking-[0.18em] uppercase">Workspaces</div>
      <button
        v-for="ws in workspace.workspaces"
        :key="ws.id"
        type="button"
        class="text-foreground hover:bg-surface-sunken flex w-full items-center justify-between px-3 py-1.5 text-left text-sm"
        @click="pickWorkspace(ws.id)"
      >
        <span>{{ ws.name }}</span>
        <Check v-if="ws.id === workspace.currentWorkspaceId" class="text-accent-500 size-3.5" />
      </button>
      <div class="border-border my-1 border-t" />
      <button
        type="button"
        class="text-foreground hover:bg-surface-sunken flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
        @click="openManage"
      >
        <FolderCog class="size-3.5" />
        Manage workspaces…
      </button>
      <button
        type="button"
        class="text-foreground hover:bg-surface-sunken flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
        @click="openManage"
      >
        <Plus class="size-3.5" />
        New workspace…
      </button>
    </div>

    <ManageWorkspacesDialog v-model:visible="manageOpen" />
    <UnsavedChangesDialog
      v-model:visible="unsavedOpen"
      message="The current layout has unsaved changes. What should we do before switching workspaces?"
      @choose="resolveUnsaved"
    />
    <SaveLayoutAsDialog
      v-model:visible="saveAsOpen"
      :default-name="(layoutStore.currentLayout?.name ?? '') + ' (saved)'"
      @save="onSaveAs"
    />
  </div>
</template>
