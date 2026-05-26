<script setup lang="ts">
import type { Ulid } from "@/types/workspace";
import type { MenuItem } from "primevue/menuitem";

import { Check, ChevronDown, FolderCog, Plus } from "@lucide/vue";
import { computed, ref } from "vue";

import ManageWorkspacesDialog from "@/components/dialogs/ManageWorkspacesDialog.vue";
import SaveLayoutAsDialog from "@/components/dialogs/SaveLayoutAsDialog.vue";
import UnsavedChangesDialog, {
  type UnsavedChoice,
} from "@/components/dialogs/UnsavedChangesDialog.vue";
import Button from "@/components/ui/Button.vue";
import { useLayoutStore } from "@/stores/layout";
import { useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";
import Menu from "@/volt/Menu.vue";

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
    <Button
      variant="ghost"
      size="sm"
      aria-haspopup="true"
      aria-controls="workspace-switcher-menu"
      @click="toggle"
    >
      <span class="text-foreground font-medium">
        {{ workspace.currentWorkspace?.name ?? "—" }}
      </span>
      <ChevronDown class="text-muted size-3.5" />
    </Button>

    <Menu id="workspace-switcher-menu" ref="menuRef" :model="menuItems" popup>
      <template #item="{ item, props: itemProps }">
        <!--
          Volt Menu's `itemLink` PT already applies `px-3 py-1.5` padding and
          hover background. The inner span here only owns the flex layout for
          icon + label + check — no padding, no hover bg, no rounded. Adding
          any of those produces a visible nested "frame" on top of Volt's
          hover state.
        -->
        <a v-bind="itemProps.action" class="flex w-full items-center gap-2 text-sm">
          <FolderCog v-if="(item as MenuItem).label === 'Manage workspaces…'" class="size-3.5" />
          <Plus v-else-if="(item as MenuItem).label === 'New workspace…'" class="size-3.5" />
          <span class="flex-1">{{ item.label }}</span>
          <Check
            v-if="(item as MenuItem & { class?: string }).class === 'is-current'"
            class="text-accent-500 size-3.5"
          />
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
