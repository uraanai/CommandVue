<script setup lang="ts">
import type { Ulid } from "@/types/workspace";
import type { MenuItem } from "primevue/menuitem";

import { Check, ChevronDown, LayoutTemplate, Plus, Settings2 } from "@lucide/vue";
import { computed, ref } from "vue";

import ManageLayoutsDialog from "@/components/dialogs/ManageLayoutsDialog.vue";
import SaveLayoutAsDialog from "@/components/dialogs/SaveLayoutAsDialog.vue";
import UnsavedChangesDialog, {
  type UnsavedChoice,
} from "@/components/dialogs/UnsavedChangesDialog.vue";
import Button from "@/components/ui/Button.vue";
import { useLayoutStore } from "@/stores/layout";
import { useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";
import Menu from "@/volt/Menu.vue";

/**
 * Layout switcher — the dock-level sibling of {@link WorkspaceSwitcher}. A
 * dropdown listing the current workspace's layouts; picking one switches the
 * active layout. Switching while the current layout is dirty routes through the
 * shared `UnsavedChangesDialog` (save / discard / save-as) exactly like the
 * workspace switch, so an unsaved arrangement is never silently dropped.
 */
const layoutStore = useLayoutStore();
const session = useSessionStore();
const workspace = useWorkspaceStore();

const menuRef = ref<InstanceType<typeof Menu> | null>(null);
const manageOpen = ref(false);
const unsavedOpen = ref(false);
const saveAsOpen = ref(false);
const pendingLayoutId = ref<null | Ulid>(null);

const menuItems = computed<MenuItem[]>(() => [
  {
    label: "Layouts",
    items: layoutStore.layouts.map((l): MenuItem & { layoutId: Ulid } => ({
      label: l.name,
      command: () => void pickLayout(l.id),
      class: l.id === layoutStore.currentLayoutId ? "is-current" : undefined,
      // Stash the layout id so the #item slot can mark the current one.
      layoutId: l.id,
    })),
  },
  { separator: true },
  { label: "New layout", command: () => void newLayout() },
  { label: "Manage layouts…", command: () => (manageOpen.value = true) },
]);

function toggle(event: MouseEvent): void {
  menuRef.value?.toggle(event);
}

async function pickLayout(id: Ulid): Promise<void> {
  if (id === layoutStore.currentLayoutId) return;
  if (session.dirty) {
    pendingLayoutId.value = id;
    unsavedOpen.value = true;
    return;
  }
  await session.switchLayout(id);
}

async function newLayout(): Promise<void> {
  const wsId = workspace.currentWorkspaceId;
  if (!wsId) return;
  const created = await layoutStore.createLayout({ workspaceId: wsId, name: "Untitled" });
  // Reuse pickLayout so a dirty current layout still prompts before we leave it.
  await pickLayout(created.id);
}

async function resolveUnsaved(choice: UnsavedChoice): Promise<void> {
  const target = pendingLayoutId.value;
  pendingLayoutId.value = null;
  if (choice === "cancel" || !target) return;
  if (choice === "save") {
    await session.updateCurrentLayout();
    await session.switchLayout(target);
    return;
  }
  if (choice === "discard") {
    await session.discardChanges();
    await session.switchLayout(target);
    return;
  }
  if (choice === "save-as") {
    pendingLayoutId.value = target;
    saveAsOpen.value = true;
  }
}

async function onSaveAs(payload: {
  name: string;
  description?: string;
  setAsWorkspaceDefault: boolean;
}): Promise<void> {
  await session.saveCurrentAsNewLayout(payload);
  const target = pendingLayoutId.value;
  pendingLayoutId.value = null;
  if (target) await session.switchLayout(target);
}
</script>

<template>
  <div class="relative">
    <Button
      variant="ghost"
      size="sm"
      aria-haspopup="true"
      aria-controls="layout-switcher-menu"
      @click="toggle"
    >
      <LayoutTemplate class="text-muted size-3.5" />
      <span class="text-foreground font-medium">{{ layoutStore.currentLayout?.name ?? "—" }}</span>
      <ChevronDown class="text-muted size-3.5" />
    </Button>

    <Menu id="layout-switcher-menu" ref="menuRef" :model="menuItems" popup>
      <template #item="{ item, props: itemProps }">
        <!--
          Volt Menu's `itemLink` PT already applies padding + hover background.
          The inner span only owns the icon / label / check layout (matching
          WorkspaceSwitcher) — adding padding/hover here would nest a frame.
        -->
        <a
          v-bind="itemProps.action"
          class="flex w-full items-center gap-2 text-[length:var(--density-font-size)]"
        >
          <Settings2 v-if="(item as MenuItem).label === 'Manage layouts…'" class="size-3.5" />
          <Plus v-else-if="(item as MenuItem).label === 'New layout'" class="size-3.5" />
          <LayoutTemplate
            v-else-if="(item as MenuItem & { layoutId?: string }).layoutId"
            class="text-muted size-3.5 shrink-0"
          />
          <span class="flex-1">{{ item.label }}</span>
          <Check
            v-if="(item as MenuItem & { class?: string }).class === 'is-current'"
            class="text-accent-500 size-3.5"
          />
        </a>
      </template>
    </Menu>

    <ManageLayoutsDialog v-model:visible="manageOpen" />
    <UnsavedChangesDialog
      v-model:visible="unsavedOpen"
      message="The current layout has unsaved changes. What should we do before switching layouts?"
      @choose="resolveUnsaved"
    />
    <SaveLayoutAsDialog
      v-model:visible="saveAsOpen"
      :default-name="(layoutStore.currentLayout?.name ?? '') + ' (saved)'"
      @save="onSaveAs"
    />
  </div>
</template>
