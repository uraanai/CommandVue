<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";

import { Hexagon } from "@lucide/vue";
import ContextMenu from "primevue/contextmenu";
import { computed, ref } from "vue";

import ManageLayoutsDialog from "@/components/dialogs/ManageLayoutsDialog.vue";
import ManageWorkspacesDialog from "@/components/dialogs/ManageWorkspacesDialog.vue";
import SaveLayoutAsDialog from "@/components/dialogs/SaveLayoutAsDialog.vue";
import { formatCombo } from "@/modules/shortcuts/catalog";
import { useChromeStore } from "@/stores/chrome";
import { useLayoutStore } from "@/stores/layout";
import { useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";
import { cn } from "@/utils/cn";

/**
 * AppIconItem — the always-on chrome item.
 *
 * Left-click opens the app brand area (currently a no-op anchor). Right-click
 * opens a PrimeVue `ContextMenu` mirroring the MenuBar's File / Edit / View
 * structure. This is the fallback affordance: when the user hides the menu
 * bar entirely, the app icon's context menu remains the only way to reach
 * the global actions. As such this item is registered with `removable: false`.
 *
 * The context menu uses PrimeVue's `ContextMenu` with `MenuItem[]` — same
 * model shape the MenuBar uses, so the two stay structurally aligned.
 */
const chrome = useChromeStore();
const session = useSessionStore();
const layoutStore = useLayoutStore();
const workspace = useWorkspaceStore();

const cm = ref<InstanceType<typeof ContextMenu> | null>(null);
const manageWorkspacesOpen = ref(false);
const manageLayoutsOpen = ref(false);
const saveAsOpen = ref(false);

const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

const menuItems = computed<MenuItem[]>(() => [
  {
    label: "File",
    items: [
      { label: "New Workspace…", command: () => (manageWorkspacesOpen.value = true) },
      {
        label: "New Layout",
        command: () => {
          if (workspace.currentWorkspaceId)
            void layoutStore.createLayout({
              workspaceId: workspace.currentWorkspaceId,
              name: "Untitled",
            });
        },
      },
      { separator: true },
      {
        label: "Save Layout",
        command: () => {
          if (session.dirty && session.loadedLayoutId) void session.updateCurrentLayout();
        },
        disabled: !session.dirty || !session.loadedLayoutId,
        shortcut: formatCombo("mod+s", isMac),
      },
      {
        label: "Save Layout As…",
        command: () => (saveAsOpen.value = true),
        shortcut: formatCombo("mod+shift+s", isMac),
      },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Manage Layouts…", command: () => (manageLayoutsOpen.value = true) },
      {
        label: "Discard Changes",
        command: () => void session.discardChanges(),
        disabled: !session.dirty,
      },
    ],
  },
  {
    label: "View",
    items: [
      {
        label: `${chrome.menuBarVisible ? "Hide" : "Show"} Menu Bar`,
        command: () => void chrome.toggleMenuBar(),
      },
      {
        label: `${chrome.statusBarVisible ? "Hide" : "Show"} Status Bar`,
        command: () => void chrome.toggleStatusBar(),
      },
      {
        label: chrome.editMode ? "Exit Edit Mode" : "Edit Chrome…",
        command: () => chrome.toggleEditMode(),
        disabled: !chrome.canEdit,
      },
    ],
  },
]);

function onContextMenu(event: MouseEvent): void {
  cm.value?.show(event);
}

async function onSaveAs(payload: {
  name: string;
  description?: string;
  setAsWorkspaceDefault: boolean;
}): Promise<void> {
  await session.saveCurrentAsNewLayout(payload);
}
</script>

<template>
  <div class="flex items-center" @contextmenu="onContextMenu">
    <button
      type="button"
      class="text-foreground hover:bg-surface-sunken flex items-center gap-1.5 rounded px-2 py-1"
      title="Right-click for app menu"
    >
      <Hexagon class="text-accent-500 size-4" />
      <span class="text-sm font-semibold tracking-tight">CommandVue</span>
    </button>

    <ContextMenu
      ref="cm"
      :model="menuItems"
      :pt="{
        root: {
          class: cn(
            'absolute z-[100] min-w-[220px] rounded-md border border-border bg-surface-raised py-1 shadow-xl',
          ),
        },
        submenu: {
          class: cn(
            'absolute z-[100] min-w-[220px] rounded-md border border-border bg-surface-raised py-1 shadow-xl',
          ),
        },
        separator: { class: 'my-1 border-t border-border' },
      }"
    >
      <template #item="{ item, props: itemProps, hasSubmenu }">
        <a v-bind="itemProps.action" class="flex items-center">
          <span
            :class="[
              'flex w-full items-center gap-2 px-3 py-1.5 text-sm',
              'text-foreground hover:bg-surface-sunken cursor-pointer rounded',
              (item as MenuItem & { disabled?: boolean }).disabled
                ? 'cursor-not-allowed opacity-40'
                : '',
            ]"
          >
            <span class="flex-1">{{ item.label }}</span>
            <span
              v-if="(item as MenuItem & { shortcut?: string }).shortcut"
              class="text-faint font-mono text-[10px]"
            >
              {{ (item as MenuItem & { shortcut?: string }).shortcut }}
            </span>
            <span v-if="hasSubmenu" class="text-faint text-xs">▸</span>
          </span>
        </a>
      </template>
    </ContextMenu>

    <ManageWorkspacesDialog v-model:visible="manageWorkspacesOpen" />
    <ManageLayoutsDialog v-model:visible="manageLayoutsOpen" />
    <SaveLayoutAsDialog
      v-model:visible="saveAsOpen"
      :default-name="(layoutStore.currentLayout?.name ?? '') + ' (saved)'"
      @save="onSaveAs"
    />
  </div>
</template>
