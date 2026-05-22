<script setup lang="ts">
import { Hexagon } from "@lucide/vue";
import { onBeforeUnmount, ref } from "vue";

import ManageLayoutsDialog from "@/components/dialogs/ManageLayoutsDialog.vue";
import ManageWorkspacesDialog from "@/components/dialogs/ManageWorkspacesDialog.vue";
import SaveLayoutAsDialog from "@/components/dialogs/SaveLayoutAsDialog.vue";
import { useChromeStore } from "@/stores/chrome";
import { useLayoutStore } from "@/stores/layout";
import { useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";

/**
 * AppIconItem — the always-on chrome item.
 *
 * Left-click opens the app brand link (currently a no-op anchor). Right-click
 * opens a context menu mirroring the MenuBar's File / Edit / View structure.
 * This is the fallback affordance: when the user hides the menu bar entirely,
 * the app icon's context menu remains the only way to reach the global
 * actions. As such this item is registered with `removable: false`.
 */
const chrome = useChromeStore();
const session = useSessionStore();
const layoutStore = useLayoutStore();
const workspace = useWorkspaceStore();

const menuOpen = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const manageWorkspacesOpen = ref(false);
const manageLayoutsOpen = ref(false);
const saveAsOpen = ref(false);

function openContext(event: MouseEvent): void {
  event.preventDefault();
  menuX.value = event.clientX;
  menuY.value = event.clientY;
  menuOpen.value = true;
}

function close(): void {
  menuOpen.value = false;
}

function onWindowClick(event: MouseEvent): void {
  if (!menuOpen.value) return;
  const target = event.target as HTMLElement;
  if (target.closest("[data-app-icon-menu]")) return;
  close();
}
window.addEventListener("click", onWindowClick);
onBeforeUnmount(() => window.removeEventListener("click", onWindowClick));

async function saveLayout(): Promise<void> {
  close();
  if (session.loadedLayoutId && session.dirty) await session.updateCurrentLayout();
}

async function newLayout(): Promise<void> {
  close();
  if (workspace.currentWorkspaceId)
    await layoutStore.createLayout({
      workspaceId: workspace.currentWorkspaceId,
      name: "Untitled",
    });
}

async function discardChanges(): Promise<void> {
  close();
  await session.discardChanges();
}

function toggleEditMode(): void {
  close();
  chrome.toggleEditMode();
}

async function toggleMenuBar(): Promise<void> {
  close();
  await chrome.toggleMenuBar();
}

async function toggleStatusBar(): Promise<void> {
  close();
  await chrome.toggleStatusBar();
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
  <div class="flex items-center" @contextmenu="openContext">
    <button
      type="button"
      class="text-foreground hover:bg-surface-sunken flex items-center gap-1.5 rounded px-2 py-1"
      title="Right-click for app menu"
    >
      <Hexagon class="text-accent-500 size-4" />
      <span class="text-sm font-semibold tracking-tight">CommandVue</span>
    </button>

    <div
      v-if="menuOpen"
      data-app-icon-menu
      class="border-border bg-surface-raised fixed z-[100] min-w-[220px] rounded-md border py-1 shadow-xl"
      :style="{ left: `${menuX}px`, top: `${menuY}px` }"
    >
      <div class="text-faint px-3 py-1 text-[10px] tracking-[0.18em] uppercase">File</div>
      <button
        type="button"
        class="text-foreground hover:bg-surface-sunken block w-full px-3 py-1.5 text-left text-sm"
        @click="
          manageWorkspacesOpen = true;
          close();
        "
      >
        New Workspace…
      </button>
      <button
        type="button"
        class="text-foreground hover:bg-surface-sunken block w-full px-3 py-1.5 text-left text-sm"
        @click="newLayout"
      >
        New Layout
      </button>
      <button
        type="button"
        class="text-foreground hover:bg-surface-sunken block w-full px-3 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!session.dirty || !session.loadedLayoutId"
        @click="saveLayout"
      >
        Save Layout
      </button>
      <button
        type="button"
        class="text-foreground hover:bg-surface-sunken block w-full px-3 py-1.5 text-left text-sm"
        @click="
          saveAsOpen = true;
          close();
        "
      >
        Save Layout As…
      </button>

      <div class="border-border my-1 border-t" />

      <div class="text-faint px-3 py-1 text-[10px] tracking-[0.18em] uppercase">Edit</div>
      <button
        type="button"
        class="text-foreground hover:bg-surface-sunken block w-full px-3 py-1.5 text-left text-sm"
        @click="
          manageLayoutsOpen = true;
          close();
        "
      >
        Manage Layouts…
      </button>
      <button
        type="button"
        class="text-foreground hover:bg-surface-sunken block w-full px-3 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!session.dirty"
        @click="discardChanges"
      >
        Discard Changes
      </button>

      <div class="border-border my-1 border-t" />

      <div class="text-faint px-3 py-1 text-[10px] tracking-[0.18em] uppercase">View</div>
      <button
        type="button"
        class="text-foreground hover:bg-surface-sunken block w-full px-3 py-1.5 text-left text-sm"
        @click="toggleMenuBar"
      >
        {{ chrome.menuBarVisible ? "Hide" : "Show" }} Menu Bar
      </button>
      <button
        type="button"
        class="text-foreground hover:bg-surface-sunken block w-full px-3 py-1.5 text-left text-sm"
        @click="toggleStatusBar"
      >
        {{ chrome.statusBarVisible ? "Hide" : "Show" }} Status Bar
      </button>
      <button
        type="button"
        class="text-foreground hover:bg-surface-sunken block w-full px-3 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!chrome.canEdit"
        @click="toggleEditMode"
      >
        {{ chrome.editMode ? "Exit Edit Mode" : "Edit Chrome…" }}
      </button>
    </div>

    <ManageWorkspacesDialog v-model:visible="manageWorkspacesOpen" />
    <ManageLayoutsDialog v-model:visible="manageLayoutsOpen" />
    <SaveLayoutAsDialog
      v-model:visible="saveAsOpen"
      :default-name="(layoutStore.currentLayout?.name ?? '') + ' (saved)'"
      @save="onSaveAs"
    />
  </div>
</template>
