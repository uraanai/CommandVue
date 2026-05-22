<script setup lang="ts">
import type { PanelDefinition } from "@/modules/panels/types";
import type { MenuItem } from "primevue/menuitem";

import Menubar from "primevue/menubar";
import { computed, ref } from "vue";

import ManageLayoutsDialog from "@/components/dialogs/ManageLayoutsDialog.vue";
import ManageWorkspacesDialog from "@/components/dialogs/ManageWorkspacesDialog.vue";
import SaveLayoutAsDialog from "@/components/dialogs/SaveLayoutAsDialog.vue";
import { panelRegistry } from "@/modules/panels/registry";
import { UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
import { formatCombo } from "@/modules/shortcuts/catalog";
import { newId } from "@/modules/storage/ids";
import { useLayoutStore } from "@/stores/layout";
import { usePanelStateStore } from "@/stores/panelState";
import { useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";

const session = useSessionStore();
const layoutStore = useLayoutStore();
const workspace = useWorkspaceStore();
const panelStateStore = usePanelStateStore();

const manageWorkspacesOpen = ref(false);
const manageLayoutsOpen = ref(false);
const saveAsOpen = ref(false);

async function saveLayout(): Promise<void> {
  if (!session.loadedLayoutId) return;
  await session.updateCurrentLayout();
}

async function addEmptyPanel(): Promise<void> {
  const layoutId = layoutStore.currentLayoutId;
  if (!layoutId) return;
  const api = session.getDockviewApi();
  if (!api) return;
  const panelId = newId();
  await panelStateStore.createPanel({
    layoutId,
    panelType: null,
    assignmentState: "empty",
    id: panelId,
  });
  api.addPanel({
    id: panelId,
    component: UNASSIGNED_PANEL_TYPE,
    title: "Empty",
    floating: true,
  });
  session.markDirty();
}

async function addPanelOfType(def: PanelDefinition): Promise<void> {
  const layoutId = layoutStore.currentLayoutId;
  if (!layoutId) return;
  const api = session.getDockviewApi();
  if (!api) return;
  const panelId = newId();
  await panelStateStore.createPanel({
    layoutId,
    panelType: def.id,
    assignmentState: "configured",
    id: panelId,
  });
  api.addPanel({
    id: panelId,
    component: def.id,
    title: def.title,
    floating: true,
  });
  session.markDirty();
}

function toggleComponentsPanel(): void {
  const api = session.getDockviewApi();
  if (!api) return;
  const states = panelStateStore.listForLayout();
  const browserState = states.find((s) => s.panelType === "components-browser");
  if (browserState) {
    const existing = api.getPanel(browserState.id);
    if (existing) {
      existing.api.close();
      return;
    }
  }
  const layoutId = layoutStore.currentLayoutId;
  if (!layoutId) return;
  const panelId = newId();
  void panelStateStore.createPanel({
    layoutId,
    panelType: "components-browser",
    assignmentState: "configured",
    id: panelId,
  });
  api.addPanel({
    id: panelId,
    component: "components-browser",
    title: "Components",
    floating: true,
  });
  session.markDirty();
}

async function discardChanges(): Promise<void> {
  await session.discardChanges();
}

async function duplicateCurrentLayout(): Promise<void> {
  if (!session.loadedLayoutId) return;
  await layoutStore.duplicateLayout(session.loadedLayoutId);
}

async function deleteCurrentLayout(): Promise<void> {
  if (!session.loadedLayoutId) return;
  const target = session.loadedLayoutId;
  try {
    await layoutStore.deleteLayout(target);
    const next = layoutStore.currentLayoutId;
    if (next) await session.loadLayout(next);
  } catch (e) {
    // InvariantError: last layout in workspace — ignore for now; Phase G
    // surfaces toasts. Logging keeps the failure visible in dev.
    console.warn("Cannot delete layout:", e);
  }
}

async function onSaveAs(payload: {
  name: string;
  description?: string;
  setAsWorkspaceDefault: boolean;
}): Promise<void> {
  await session.saveCurrentAsNewLayout(payload);
}

function buildAddComponentChildren(): MenuItem[] {
  const grouped = panelRegistry.listByCategory();
  const out: MenuItem[] = [];
  for (const [category, defs] of Object.entries(grouped)) {
    const filtered = defs.filter(
      (d) => d.id !== UNASSIGNED_PANEL_TYPE && d.id !== "components-browser",
    );
    if (filtered.length === 0) continue;
    out.push({
      label: category.charAt(0).toUpperCase() + category.slice(1),
      items: filtered.map((def) => ({
        label: def.title,
        command: () => {
          void addPanelOfType(def);
        },
      })),
    });
  }
  return out.sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
}

function labelOf(item: MenuItem): string {
  const l = item.label;
  return typeof l === "string" ? l : "";
}

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
        command: () => void saveLayout(),
        disabled: !session.dirty || !session.loadedLayoutId,
        shortcut: formatCombo("mod+s", isMac),
      },
      {
        label: "Save Layout As…",
        command: () => (saveAsOpen.value = true),
        shortcut: formatCombo("mod+shift+s", isMac),
      },
      { separator: true },
      { label: "Import Workspace…", disabled: true },
      { label: "Export Workspace…", disabled: true },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Undo", disabled: true },
      { label: "Redo", disabled: true },
      { separator: true },
      { label: "Rename Layout…", command: () => (manageLayoutsOpen.value = true) },
      { label: "Duplicate Layout", command: () => void duplicateCurrentLayout() },
      { label: "Delete Layout…", command: () => void deleteCurrentLayout() },
      { separator: true },
      { label: "Manage Presets…", disabled: true },
    ],
  },
  {
    label: "View",
    items: [
      {
        label: "Add Component",
        items: buildAddComponentChildren(),
      },
      { label: "Add Empty Panel", command: () => void addEmptyPanel() },
      { separator: true },
      {
        label: "Components Panel",
        command: () => toggleComponentsPanel(),
        shortcut: formatCombo("mod+b", isMac),
      },
      { separator: true },
      { label: "Discard Changes", command: () => void discardChanges(), disabled: !session.dirty },
    ],
  },
]);
</script>

<template>
  <Menubar
    :model="menuItems"
    :pt="{
      root: { class: 'flex items-stretch gap-0 px-2 py-0 bg-transparent border-0' },
      rootList: { class: 'flex items-stretch gap-0' },
      submenu: {
        class:
          'absolute z-50 min-w-[220px] rounded-md border border-border bg-surface-raised py-1 shadow-lg',
      },
      separator: { class: 'my-1 border-t border-border' },
    }"
  >
    <template #item="{ item, props: itemProps, hasSubmenu, root }">
      <a v-bind="itemProps.action" class="flex items-center">
        <span
          :class="[
            'flex w-full items-center gap-2 px-2 py-1 text-xs',
            root
              ? 'text-muted hover:text-foreground rounded'
              : 'text-foreground hover:bg-surface-sunken cursor-pointer rounded px-3 py-1.5 text-sm',
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
  </Menubar>

  <ManageWorkspacesDialog v-model:visible="manageWorkspacesOpen" />
  <ManageLayoutsDialog v-model:visible="manageLayoutsOpen" />
  <SaveLayoutAsDialog
    v-model:visible="saveAsOpen"
    :default-name="(layoutStore.currentLayout?.name ?? '') + ' (saved)'"
    @save="onSaveAs"
  />
</template>
