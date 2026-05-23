<script setup lang="ts">
import type { Ulid } from "@/types/workspace";
import type { MenuItem } from "primevue/menuitem";

import { Check, ChevronDown, FolderCog, Plus } from "@lucide/vue";
import Menu from "primevue/menu";
import { computed, ref } from "vue";

import ManageWorkspacesDialog from "@/components/dialogs/ManageWorkspacesDialog.vue";
import SaveLayoutAsDialog from "@/components/dialogs/SaveLayoutAsDialog.vue";
import UnsavedChangesDialog, {
  type UnsavedChoice,
} from "@/components/dialogs/UnsavedChangesDialog.vue";
import { useLayoutStore } from "@/stores/layout";
import { useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";
import { cn } from "@/utils/cn";

const workspace = useWorkspaceStore();
const layoutStore = useLayoutStore();
const session = useSessionStore();

const menuRef = ref<InstanceType<typeof Menu> | null>(null);
const manageOpen = ref(false);
const unsavedOpen = ref(false);
const saveAsOpen = ref(false);
const pendingWorkspaceId = ref<null | Ulid>(null);

const menuItems = computed<MenuItem[]>(() => [
  {
    label: "Workspaces",
    items: workspace.workspaces.map((ws) => ({
      label: ws.name,
      command: () => void pickWorkspace(ws.id),
      class: ws.id === workspace.currentWorkspaceId ? "is-current" : undefined,
    })),
  },
  { separator: true },
  {
    label: "Manage workspaces…",
    command: () => (manageOpen.value = true),
  },
  {
    label: "New workspace…",
    command: () => (manageOpen.value = true),
  },
]);

function toggle(event: MouseEvent): void {
  menuRef.value?.toggle(event);
}

async function pickWorkspace(id: Ulid): Promise<void> {
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
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="text-muted hover:text-foreground hover:bg-surface-sunken flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors"
      aria-haspopup="true"
      aria-controls="workspace-switcher-menu"
      @click="toggle"
    >
      <span class="text-foreground font-medium">
        {{ workspace.currentWorkspace?.name ?? "—" }}
      </span>
      <ChevronDown class="size-3.5" />
    </button>

    <Menu
      id="workspace-switcher-menu"
      ref="menuRef"
      :model="menuItems"
      popup
      :pt="{
        root: {
          class: cn(
            'absolute z-[100] mt-1 min-w-[220px] rounded-md border border-border bg-surface-raised py-1 shadow-lg',
          ),
        },
        submenuLabel: {
          class: 'text-faint px-3 py-1 text-[10px] tracking-[0.18em] uppercase',
        },
        separator: { class: 'my-1 border-t border-border' },
      }"
    >
      <template #item="{ item, props: itemProps }">
        <a v-bind="itemProps.action" class="flex items-center">
          <span
            class="text-foreground hover:bg-surface-sunken flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm"
          >
            <FolderCog v-if="(item as MenuItem).label === 'Manage workspaces…'" class="size-3.5" />
            <Plus v-else-if="(item as MenuItem).label === 'New workspace…'" class="size-3.5" />
            <span class="flex-1">{{ item.label }}</span>
            <Check
              v-if="(item as MenuItem & { class?: string }).class === 'is-current'"
              class="text-accent-500 size-3.5"
            />
          </span>
        </a>
      </template>
    </Menu>

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
