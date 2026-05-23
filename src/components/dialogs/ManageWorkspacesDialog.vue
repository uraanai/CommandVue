<script setup lang="ts">
import { Check, Plus, Star, Trash2 } from "@lucide/vue";
import Column from "primevue/column";
import DataTable, { type DataTableRowEditSaveEvent } from "primevue/datatable";
import { ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { useWorkspaceStore } from "@/stores/workspace";
import { cn } from "@/utils/cn";

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const workspace = useWorkspaceStore();
const newName = ref("");
const error = ref<string | null>(null);
// DataTable row-edit state — PrimeVue tracks edit by row id when v-model:editingRows is bound.
const editingRows = ref<{ id: string }[]>([]);

watch(
  () => props.visible,
  (open) => {
    if (open) {
      newName.value = "";
      error.value = null;
      editingRows.value = [];
    }
  },
);

async function create(): Promise<void> {
  if (!newName.value.trim()) return;
  error.value = null;
  try {
    const ws = await workspace.createWorkspace({ name: newName.value.trim() });
    // Newly created workspaces need ≥1 layout (invariant 6) before the user
    // can switch in — auto-create a "Default" layout.
    await layoutRepo.create({ workspaceId: ws.id, name: "Default" });
    newName.value = "";
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function onRowEditSave(event: DataTableRowEditSaveEvent): Promise<void> {
  const { newData } = event;
  const next = newData as { id: string; name: string };
  if (!next.name?.trim()) return;
  await workspace.renameWorkspace(next.id, { name: next.name.trim() });
}

async function makeDefault(id: string): Promise<void> {
  await workspace.setGlobalDefault(id);
}

async function remove(id: string): Promise<void> {
  error.value = null;
  try {
    await workspace.deleteWorkspace(id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Manage workspaces"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <div class="flex flex-col gap-3">
      <div class="flex items-end gap-2">
        <label class="flex flex-1 flex-col gap-1">
          <span class="text-faint text-[10px] tracking-[0.18em] uppercase">New workspace</span>
          <Input v-model="newName" placeholder="Workspace name" @keydown.enter="create" />
        </label>
        <Button variant="primary" size="sm" :disabled="!newName.trim()" @click="create">
          <Plus class="size-3.5" />
          Create
        </Button>
      </div>
      <p v-if="error" class="text-danger text-xs">{{ error }}</p>

      <DataTable
        v-model:editing-rows="editingRows"
        :value="workspace.workspaces"
        data-key="id"
        edit-mode="row"
        size="small"
        :pt="{
          root: { class: cn('border border-border rounded-md overflow-hidden') },
          table: { class: 'w-full text-sm' },
          thead: { class: 'bg-surface-sunken' },
          headerRow: { class: 'border-b border-border' },
          headerCell: {
            class: 'text-faint px-3 py-2 text-[10px] tracking-[0.18em] uppercase text-left',
          },
          bodyRow: { class: 'border-b border-border last:border-b-0' },
          bodyCell: { class: 'px-3 py-2 text-foreground' },
        }"
        @row-edit-save="onRowEditSave"
      >
        <Column field="name" header="Name" style="min-width: 12rem">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <span>{{ data.name }}</span>
              <Star
                v-if="data.isGlobalDefault"
                class="text-accent-500 size-3.5"
                aria-label="Global default"
              />
            </div>
          </template>
          <template #editor="{ data, field }">
            <Input v-model="data[field]" />
          </template>
        </Column>
        <Column header="Actions" header-style="width: 18rem">
          <template #body="{ data, editorInitCallback }">
            <div class="flex items-center justify-end gap-1">
              <Button size="sm" variant="ghost" @click="editorInitCallback">
                <Check class="size-3.5" />
                Rename
              </Button>
              <Button
                v-if="!data.isGlobalDefault"
                size="sm"
                variant="ghost"
                @click="makeDefault(data.id)"
              >
                Make default
              </Button>
              <Button
                size="sm"
                variant="ghost"
                :disabled="workspace.workspaces.length <= 1"
                @click="remove(data.id)"
              >
                <Trash2 class="size-3.5" />
              </Button>
            </div>
          </template>
          <template #editor="{ editorSaveCallback, editorCancelCallback }">
            <div class="flex items-center justify-end gap-1">
              <Button size="sm" variant="primary" @click="editorSaveCallback">
                <Check class="size-3.5" />
                Save
              </Button>
              <Button size="sm" variant="ghost" @click="editorCancelCallback">Cancel</Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
    <template #footer>
      <Button variant="primary" size="sm" @click="emit('update:visible', false)">Done</Button>
    </template>
  </Dialog>
</template>
