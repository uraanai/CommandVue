<script setup lang="ts">
import type { Preset } from "@/types/preset";

import { ChevronRight, Copy, Globe, Layers, Pencil, Plus, Trash2 } from "@lucide/vue";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import { ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Tabs from "@/components/ui/Tabs.vue";
import { presetTypeRegistry } from "@/modules/presets/registry";
import { usePresetStore } from "@/stores/preset";
import { useWorkspaceStore } from "@/stores/workspace";
import { cn } from "@/utils/cn";
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

const editTarget = ref<null | Preset>(null);
const editOpen = ref(false);
const error = ref<null | string>(null);
const activeTab = ref<"global" | "workspace">("global");

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

const dataTablePT = {
  root: { class: cn("border border-border rounded-md overflow-hidden") },
  table: { class: "w-full text-sm" },
  thead: { class: "bg-surface-sunken" },
  headerRow: { class: "border-b border-border" },
  headerCell: {
    class: "text-faint px-3 py-2 text-[10px] tracking-[0.18em] uppercase text-left",
  },
  bodyRow: { class: "border-b border-border last:border-b-0" },
  bodyCell: { class: "px-3 py-2 text-foreground" },
  emptyMessage: { class: "px-3 py-6 text-center text-sm text-muted" },
};
</script>

<template>
  <Dialog
    :visible="visible"
    header="Manage presets"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="flex flex-col gap-3">
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
              :value="presetStore.globalPresets"
              data-key="id"
              size="small"
              :pt="dataTablePT"
            >
              <template #empty>No global presets yet.</template>
              <Column field="name" header="Name" style="min-width: 12rem">
                <template #body="{ data }">
                  <div>
                    <div class="text-foreground font-medium">{{ data.name }}</div>
                    <div class="text-faint text-xs">
                      {{ presetTypeRegistry.get(data.presetTypeId)?.title ?? data.presetTypeId }}
                      <template v-if="data.description"> · {{ data.description }}</template>
                    </div>
                  </div>
                </template>
              </Column>
              <Column header="Actions" header-style="width: 14rem">
                <template #body="{ data }">
                  <div class="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" @click="startEdit(data)">
                      <Pencil class="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" @click="duplicatePreset(data)">
                      <Copy class="size-3.5" />
                    </Button>
                    <Button
                      v-if="workspace.currentWorkspaceId"
                      size="sm"
                      variant="ghost"
                      title="Copy to current workspace"
                      @click="scope(data)"
                    >
                      <ChevronRight class="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" @click="removePreset(data)">
                      <Trash2 class="size-3.5" />
                    </Button>
                  </div>
                </template>
              </Column>
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
              :value="presetStore.workspacePresets"
              data-key="id"
              size="small"
              :pt="dataTablePT"
            >
              <template #empty>No workspace-scoped presets yet.</template>
              <Column field="name" header="Name" style="min-width: 12rem">
                <template #body="{ data }">
                  <div>
                    <div class="text-foreground font-medium">{{ data.name }}</div>
                    <div class="text-faint text-xs">
                      {{ presetTypeRegistry.get(data.presetTypeId)?.title ?? data.presetTypeId }}
                      <template v-if="data.description"> · {{ data.description }}</template>
                    </div>
                  </div>
                </template>
              </Column>
              <Column header="Actions" header-style="width: 14rem">
                <template #body="{ data }">
                  <div class="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" @click="startEdit(data)">
                      <Pencil class="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" @click="duplicatePreset(data)">
                      <Copy class="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Promote to global"
                      @click="promote(data)"
                    >
                      <Globe class="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" @click="removePreset(data)">
                      <Trash2 class="size-3.5" />
                    </Button>
                  </div>
                </template>
              </Column>
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
