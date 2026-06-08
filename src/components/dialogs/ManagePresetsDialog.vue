<script setup lang="ts">
import type { Preset } from "@/types/preset";

import { Copy, FolderInput, Globe, Layers, Pencil, Plus, Trash2 } from "@lucide/vue";
import { computed, ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import DataTable from "@/components/ui/DataTable.vue";
import { createColumnHelper } from "@/components/ui/datatable/columnHelpers";
import IconButton from "@/components/ui/IconButton.vue";
import Tabs from "@/components/ui/Tabs.vue";
import { presetTypeRegistry } from "@/modules/presets/registry";
import { usePresetStore } from "@/stores/preset";
import { useThemeStore } from "@/stores/theme";
import { useWorkspaceStore } from "@/stores/workspace";
import Dialog from "@/volt/Dialog.vue";

import EditPresetDialog from "./EditPresetDialog.vue";

interface TabDef {
  id: "global" | "workspace";
  label: string;
}

const tabs: TabDef[] = [
  { id: "global", label: "Global" },
  { id: "workspace", label: "Workspace" },
];

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const presetStore = usePresetStore();
const workspace = useWorkspaceStore();
const themeStore = useThemeStore();

// Table density follows the active theme — the same single source of truth the
// EntityList panel uses (themeStore.currentTheme.density, mirrored to
// data-density on <html>). Cell padding then resolves from the --density-*
// tokens inside the <DataTable> wrapper, so the rows track the global density.
const density = computed(() => themeStore.currentTheme?.density ?? "comfortable");

const editTarget = ref<null | Preset>(null);
const editOpen = ref(false);
const error = ref<null | string>(null);
const activeTab = ref<"global" | "workspace">("global");

// Two columns: a flexible Name (sized to fill the 480px dialog at comfortable
// density) and a fixed Actions column. Sorting/resize/visibility are disabled —
// these are short management lists, not data grids.
const helper = createColumnHelper<Preset>();
const presetColumns = [
  helper.accessor("name", { id: "name", header: "Name", size: 200, enableSorting: false }),
  helper.display({ id: "actions", header: "Actions", size: 184, enableSorting: false }),
];

watch(
  () => props.visible,
  async (open) => {
    if (!open) return;
    error.value = null;
    if (workspace.currentWorkspaceId) {
      await presetStore.loadForWorkspace(workspace.currentWorkspaceId);
    } else {
      await presetStore.loadAll();
    }
  },
);

async function createOfType(typeId: string): Promise<void> {
  const def = presetTypeRegistry.get(typeId);
  if (!def) return;
  const workspaceId = activeTab.value === "global" ? null : (workspace.currentWorkspaceId ?? null);
  const preset = await presetStore.createPreset({
    presetTypeId: typeId,
    workspaceId,
    name: `New ${def.title}`,
    config: structuredClone(def.defaultConfig),
  });
  editTarget.value = preset;
  editOpen.value = true;
}

function startEdit(preset: Preset): void {
  editTarget.value = preset;
  editOpen.value = true;
}

async function duplicatePreset(preset: Preset): Promise<void> {
  await presetStore.duplicatePreset(preset.id);
}

async function promote(preset: Preset): Promise<void> {
  await presetStore.duplicatePreset(preset.id, { workspaceId: null });
}

async function scope(preset: Preset): Promise<void> {
  if (!workspace.currentWorkspaceId) return;
  await presetStore.duplicatePreset(preset.id, { workspaceId: workspace.currentWorkspaceId });
}

async function removePreset(preset: Preset): Promise<void> {
  error.value = null;
  try {
    await presetStore.deletePreset(preset.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

function typeLabel(preset: Preset): string {
  return presetTypeRegistry.get(preset.presetTypeId)?.title ?? preset.presetTypeId;
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Manage presets"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="flex flex-col gap-3">
      <p class="text-muted text-xs">
        A preset is a reusable bundle of visual settings you apply to a panel (map style, overlay,
        chart theme, panel appearance). Global presets are available in every workspace; Workspace
        presets are scoped to the current one. Create, edit, duplicate, move between scopes, or
        delete them.
      </p>
      <Tabs v-model="activeTab" :tabs="tabs">
        <template #tab-global>
          <Globe class="size-3" />
          Global ({{ presetStore.globalPresets.length }})
        </template>
        <template #tab-workspace>
          <Layers class="size-3" />
          Workspace ({{ presetStore.workspacePresets.length }})
        </template>
        <template #default="{ active }">
          <div v-if="active === 'global'">
            <div class="border-border bg-surface-sunken mb-3 rounded-md border p-3">
              <div class="text-faint mb-2 text-[10px] tracking-[0.18em] uppercase">
                Create new global preset
              </div>
              <div class="flex flex-wrap gap-2">
                <Button
                  v-for="def in presetTypeRegistry.list()"
                  :key="def.id"
                  size="sm"
                  variant="secondary"
                  @click="createOfType(def.id)"
                >
                  <Plus class="size-3" />
                  {{ def.title }}
                </Button>
              </div>
            </div>
            <DataTable
              :data="presetStore.globalPresets"
              :columns="presetColumns"
              row-key="id"
              :density="density"
              :enable-sorting="false"
              :enable-column-resize="false"
              :enable-column-visibility="false"
              :enable-filtering="false"
              container-height="auto"
              empty-message="No global presets yet."
              class="border-border overflow-hidden rounded-md border"
            >
              <template #header-actions>
                <div class="w-full pr-1 text-right">Actions</div>
              </template>
              <template #cell-name="{ row }">
                <div class="min-w-0">
                  <div class="text-foreground truncate font-medium">{{ (row as Preset).name }}</div>
                  <div class="text-faint truncate text-xs">
                    {{ typeLabel(row as Preset) }}
                    <template v-if="(row as Preset).description">
                      · {{ (row as Preset).description }}</template
                    >
                  </div>
                </div>
              </template>
              <template #cell-actions="{ row }">
                <div class="flex w-full items-center justify-end gap-1">
                  <IconButton label="Edit" size="sm" title="Edit" @click="startEdit(row as Preset)">
                    <Pencil />
                  </IconButton>
                  <IconButton
                    label="Duplicate"
                    size="sm"
                    title="Duplicate"
                    @click="duplicatePreset(row as Preset)"
                  >
                    <Copy />
                  </IconButton>
                  <IconButton
                    v-if="workspace.currentWorkspaceId"
                    label="Copy to current workspace"
                    size="sm"
                    title="Copy to current workspace"
                    @click="scope(row as Preset)"
                  >
                    <FolderInput />
                  </IconButton>
                  <IconButton
                    label="Delete"
                    size="sm"
                    title="Delete"
                    @click="removePreset(row as Preset)"
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              </template>
            </DataTable>
          </div>
          <div v-else-if="active === 'workspace'">
            <div class="border-border bg-surface-sunken mb-3 rounded-md border p-3">
              <div class="text-faint mb-2 text-[10px] tracking-[0.18em] uppercase">
                Create new workspace-scoped preset
              </div>
              <div class="flex flex-wrap gap-2">
                <Button
                  v-for="def in presetTypeRegistry.list()"
                  :key="def.id"
                  size="sm"
                  variant="secondary"
                  :disabled="!workspace.currentWorkspaceId"
                  @click="createOfType(def.id)"
                >
                  <Plus class="size-3" />
                  {{ def.title }}
                </Button>
              </div>
            </div>
            <DataTable
              :data="presetStore.workspacePresets"
              :columns="presetColumns"
              row-key="id"
              :density="density"
              :enable-sorting="false"
              :enable-column-resize="false"
              :enable-column-visibility="false"
              :enable-filtering="false"
              container-height="auto"
              empty-message="No workspace-scoped presets yet."
              class="border-border overflow-hidden rounded-md border"
            >
              <template #header-actions>
                <div class="w-full pr-1 text-right">Actions</div>
              </template>
              <template #cell-name="{ row }">
                <div class="min-w-0">
                  <div class="text-foreground truncate font-medium">{{ (row as Preset).name }}</div>
                  <div class="text-faint truncate text-xs">
                    {{ typeLabel(row as Preset) }}
                    <template v-if="(row as Preset).description">
                      · {{ (row as Preset).description }}</template
                    >
                  </div>
                </div>
              </template>
              <template #cell-actions="{ row }">
                <div class="flex w-full items-center justify-end gap-1">
                  <IconButton label="Edit" size="sm" title="Edit" @click="startEdit(row as Preset)">
                    <Pencil />
                  </IconButton>
                  <IconButton
                    label="Duplicate"
                    size="sm"
                    title="Duplicate"
                    @click="duplicatePreset(row as Preset)"
                  >
                    <Copy />
                  </IconButton>
                  <IconButton
                    label="Promote to global"
                    size="sm"
                    title="Promote to global"
                    @click="promote(row as Preset)"
                  >
                    <Globe />
                  </IconButton>
                  <IconButton
                    label="Delete"
                    size="sm"
                    title="Delete"
                    @click="removePreset(row as Preset)"
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              </template>
            </DataTable>
          </div>
        </template>
      </Tabs>

      <p v-if="error" class="text-danger text-xs">{{ error }}</p>
    </div>

    <template #footer>
      <Button variant="primary" size="sm" @click="emit('update:visible', false)">Done</Button>
    </template>
  </Dialog>

  <EditPresetDialog v-model:visible="editOpen" :preset="editTarget" />
</template>
