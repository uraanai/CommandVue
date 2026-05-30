<script setup lang="ts">
import { Check, Copy, Star, Trash2 } from "@lucide/vue";
import Column from "primevue/column";
import DataTable, { type DataTableRowEditSaveEvent } from "primevue/datatable";
import { ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import { useLayoutStore } from "@/stores/layout";
import { useWorkspaceStore } from "@/stores/workspace";
import { cn } from "@/utils/cn";
import Dialog from "@/volt/Dialog.vue";

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const workspace = useWorkspaceStore();
const layoutStore = useLayoutStore();
const editingRows = ref<{ id: string }[]>([]);
const error = ref<string | null>(null);

watch(
  () => props.visible,
  (open) => {
    if (open) {
      editingRows.value = [];
      error.value = null;
    }
  },
);

async function onRowEditSave(event: DataTableRowEditSaveEvent): Promise<void> {
  const { newData } = event;
  const next = newData as { id: string; name: string };
  if (!next.name?.trim()) return;
  await layoutStore.renameLayout(next.id, { name: next.name.trim() });
}

async function makeDefault(id: string): Promise<void> {
  if (!workspace.currentWorkspaceId) return;
  await layoutStore.setDefaultForWorkspace(workspace.currentWorkspaceId, id);
  await layoutStore.loadForWorkspace(workspace.currentWorkspaceId);
}

async function duplicate(id: string): Promise<void> {
  await layoutStore.duplicateLayout(id);
}

async function remove(id: string): Promise<void> {
  error.value = null;
  try {
    await layoutStore.deleteLayout(id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Manage layouts"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="flex flex-col gap-3">
      <p class="text-muted text-xs">
        Layouts in
        <span class="text-foreground font-medium">{{
          workspace.currentWorkspace?.name ?? "—"
        }}</span>
      </p>
      <p v-if="error" class="text-danger text-xs">{{ error }}</p>

      <DataTable
        v-model:editing-rows="editingRows"
        :value="layoutStore.layouts"
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
                v-if="workspace.currentWorkspace?.defaultLayoutId === data.id"
                class="text-accent-500 size-3.5"
                aria-label="Workspace default"
              />
            </div>
          </template>
          <template #editor="{ data, field }">
            <Input v-model="data[field]" />
          </template>
        </Column>
        <Column header="Actions" header-style="width: 22rem">
          <template #body="{ data, editorInitCallback }">
            <div class="flex items-center justify-end gap-1">
              <Button size="sm" variant="ghost" @click="editorInitCallback">
                <Check class="size-3.5" />
                Rename
              </Button>
              <Button
                v-if="workspace.currentWorkspace?.defaultLayoutId !== data.id"
                size="sm"
                variant="ghost"
                @click="makeDefault(data.id)"
              >
                Make default
              </Button>
              <Button size="sm" variant="ghost" @click="duplicate(data.id)">
                <Copy class="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                :disabled="layoutStore.layouts.length <= 1"
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
              <Button size="sm" variant="secondary" @click="editorCancelCallback">Cancel</Button>
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
