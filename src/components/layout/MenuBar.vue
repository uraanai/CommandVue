<script setup lang="ts">
import type { PanelDefinition } from "@/modules/panels/types";
import type { Theme } from "@/types/theme";
import type { MenuItem } from "primevue/menuitem";

import { ChevronDown, ChevronRight } from "@lucide/vue";
import { type FileUploadSelectEvent } from "primevue/fileupload";
import { computed, ref } from "vue";

import ManageLayoutsDialog from "@/components/dialogs/ManageLayoutsDialog.vue";
import ManagePresetsDialog from "@/components/dialogs/ManagePresetsDialog.vue";
import ManageWorkspacesDialog from "@/components/dialogs/ManageWorkspacesDialog.vue";
import SaveLayoutAsDialog from "@/components/dialogs/SaveLayoutAsDialog.vue";
import ThemeCustomizerDialog from "@/components/dialogs/ThemeCustomizerDialog.vue";
import ThemeImportDialog from "@/components/dialogs/ThemeImportDialog.vue";
import ThemePickerDialog from "@/components/dialogs/ThemePickerDialog.vue";
import FileUpload from "@/components/ui/FileUpload.vue";
import Menubar from "@/components/ui/Menubar.vue";
import { panelRegistry } from "@/modules/panels/registry";
import { UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
import { formatCombo } from "@/modules/shortcuts/catalog";
import { newId } from "@/modules/storage/ids";
import {
  exportWorkspace,
  importWorkspace,
  type PortableWorkspace,
} from "@/modules/workspaces/portable";
import { useLayoutStore } from "@/stores/layout";
import { usePanelStateStore } from "@/stores/panelState";
import { useSessionStore } from "@/stores/session";
import { useThemeStore } from "@/stores/theme";
import { useWorkspaceStore } from "@/stores/workspace";

const session = useSessionStore();
const layoutStore = useLayoutStore();
const workspace = useWorkspaceStore();
const panelStateStore = usePanelStateStore();
const themeStore = useThemeStore();

const manageWorkspacesOpen = ref(false);
const manageLayoutsOpen = ref(false);
const managePresetsOpen = ref(false);
const themePickerOpen = ref(false);
const themeImportOpen = ref(false);
const themeCustomizerOpen = ref(false);
// When set, the customizer opens in edit mode pre-filled from this theme.
// Cleared on dialog close so a subsequent "Create new theme…" starts blank.
const themeToEdit = ref<Theme | null>(null);
const saveAsOpen = ref(false);

// "Edit current theme…" is only meaningful when the active theme is one the
// engine produced — built-in / user / imported themes don't carry the
// `generation` block the customizer needs to pre-fill its inputs.
const canEditCurrentTheme = computed(
  () => themeStore.currentTheme?.source === "generated" && !!themeStore.currentTheme.generation,
);

function openCustomizer(edit: boolean): void {
  themeToEdit.value = edit ? themeStore.currentTheme : null;
  themeCustomizerOpen.value = true;
}

function onCustomizerVisibleChange(visible: boolean): void {
  themeCustomizerOpen.value = visible;
  if (!visible) themeToEdit.value = null;
}

// FileUpload — kept hidden by the wrapper; menu items trigger `choose()`
// programmatically. customUpload + auto means @select fires immediately with
// the picked file without any HTTP round-trip. The wrapper exposes `choose`
// and `clear` via `defineExpose` so the manual ref typing the previous
// direct-PrimeVue usage required is no longer needed.
const importFileRef = ref<InstanceType<typeof FileUpload> | null>(null);

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
    // InvariantError: last layout in workspace — log so the failure is
    // visible in dev. Toast surfacing is a Phase G follow-up.
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

async function onExportWorkspace(): Promise<void> {
  const id = workspace.currentWorkspaceId;
  if (!id) return;
  const payload = await exportWorkspace(id, { includeChrome: true });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const name = (workspace.currentWorkspace?.name ?? "workspace").replace(/\s+/g, "-").toLowerCase();
  const a = document.createElement("a");
  a.href = url;
  a.download = `commandvue-workspace-${name}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerImportWorkspace(): void {
  importFileRef.value?.choose();
}

async function onImportFileSelect(event: FileUploadSelectEvent): Promise<void> {
  const fileList = event.files as File[] | undefined;
  const file = fileList?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text) as PortableWorkspace;
    const imported = await importWorkspace(data, { renameOnConflict: true, importChrome: true });
    await workspace.loadAll();
    await workspace.setCurrentWorkspace(imported.id);
    await layoutStore.loadForWorkspace(imported.id);
    if (layoutStore.currentLayoutId) await session.loadLayout(layoutStore.currentLayoutId);
  } catch (err) {
    console.warn("Import failed:", err);
  } finally {
    // FileUpload retains the selection until cleared; clear so the same file
    // can be re-picked if the user wants to retry.
    importFileRef.value?.clear();
  }
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
      { label: "Import Workspace…", command: triggerImportWorkspace },
      {
        label: "Export Workspace…",
        command: () => void onExportWorkspace(),
        disabled: !workspace.currentWorkspaceId,
      },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Undo", disabled: true },
      { label: "Redo", disabled: true },
      { separator: true },
      { label: "Manage Layouts…", command: () => (manageLayoutsOpen.value = true) },
      { label: "Duplicate Layout", command: () => void duplicateCurrentLayout() },
      { label: "Delete Layout…", command: () => void deleteCurrentLayout() },
      { separator: true },
      { label: "Manage Presets…", command: () => (managePresetsOpen.value = true) },
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
      { label: "Themes…", command: () => (themePickerOpen.value = true) },
      { label: "Create new theme…", command: () => openCustomizer(false) },
      {
        label: "Edit current theme…",
        command: () => openCustomizer(true),
        disabled: !canEditCurrentTheme.value,
      },
      { label: "Import theme…", command: () => (themeImportOpen.value = true) },
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
      // Override the wrapper's default top-bar surface; the layout MenuBar
      // sits inside the chrome bar which already paints surface-raised + a
      // bottom border, so we keep this one transparent.
      root: { class: 'flex items-stretch gap-0 border-0 bg-transparent px-2 py-0' },
      rootList: { class: 'flex items-stretch gap-0' },
    }"
  >
    <template #item="{ item, props: itemProps, hasSubmenu, root }">
      <!--
        Hover background + rounded corners come from the Menubar wrapper's
        `itemContent` PT. The consumer template here only owns text color,
        padding (which differs between root buttons and nested items), text
        size, and the icon/shortcut layout. Adding `hover:bg-…` or `rounded`
        here would stack on top of the wrapper and produce a visible nested
        frame on hover.
      -->
      <a
        v-bind="itemProps.action"
        :class="[
          'flex w-full items-center gap-1 px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)] text-[length:var(--density-font-size)] leading-none',
          root ? 'text-muted hover:text-foreground' : 'text-foreground',
          (item as MenuItem & { disabled?: boolean }).disabled
            ? 'cursor-not-allowed opacity-40'
            : 'cursor-pointer',
        ]"
      >
        <span class="flex-1 leading-none">{{ item.label }}</span>
        <span
          v-if="(item as MenuItem & { shortcut?: string }).shortcut"
          class="text-faint font-mono text-[10px]"
        >
          {{ (item as MenuItem & { shortcut?: string }).shortcut }}
        </span>
        <ChevronDown v-if="hasSubmenu && root" class="text-faint size-3" />
        <ChevronRight v-else-if="hasSubmenu" class="text-faint size-3.5" />
      </a>
    </template>
  </Menubar>

  <!-- Hidden FileUpload — triggered via importFileRef.choose() from
       the File → Import Workspace… menu item. The wrapper defaults to
       basic+customUpload+auto+hidden so consumers only need to pass accept
       and a select handler. -->
  <FileUpload ref="importFileRef" accept="application/json,.json" @select="onImportFileSelect" />

  <ManageWorkspacesDialog v-model:visible="manageWorkspacesOpen" />
  <ManageLayoutsDialog v-model:visible="manageLayoutsOpen" />
  <ManagePresetsDialog v-model:visible="managePresetsOpen" />
  <ThemePickerDialog v-model:visible="themePickerOpen" />
  <ThemeImportDialog v-model:visible="themeImportOpen" />
  <ThemeCustomizerDialog
    :visible="themeCustomizerOpen"
    :theme-to-edit="themeToEdit"
    @update:visible="onCustomizerVisibleChange"
  />
  <SaveLayoutAsDialog
    v-model:visible="saveAsOpen"
    :default-name="(layoutStore.currentLayout?.name ?? '') + ' (saved)'"
    @save="onSaveAs"
  />
</template>
