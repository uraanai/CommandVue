<script setup lang="ts">
import type { Layout } from "@/types/workspace";

import { Check, Copy, Pencil, Star, Trash2 } from "@lucide/vue";
import { computed, ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import DataTable from "@/components/ui/DataTable.vue";
import { createColumnHelper } from "@/components/ui/datatable/columnHelpers";
import IconButton from "@/components/ui/IconButton.vue";
import Input from "@/components/ui/Input.vue";
import { useLayoutStore } from "@/stores/layout";
import { useThemeStore } from "@/stores/theme";
import { useWorkspaceStore } from "@/stores/workspace";
import Dialog from "@/volt/Dialog.vue";

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const workspace = useWorkspaceStore();
const layoutStore = useLayoutStore();
const themeStore = useThemeStore();
const error = ref<string | null>(null);

// Inline rename state. The default <DataTable> wrapper (TanStack, ADR 0001) has
// no built-in row editing, so we drive it ourselves: the row whose id matches
// editingId swaps its Name cell to an <Input> and its actions to Save / Cancel.
const editingId = ref<null | string>(null);
const draftName = ref("");

// Focus + select the rename input the moment it mounts (the static `autofocus`
// attribute only fires on initial page load, not on a v-if toggle).
const vFocus = {
  mounted: (el: HTMLElement): void => {
    const input = el instanceof HTMLInputElement ? el : el.querySelector("input");
    input?.focus();
    input?.select();
  },
};

// Density follows the active theme — see EntityListPanel for the rationale.
const density = computed(() => themeStore.currentTheme?.density ?? "comfortable");

// Flexible Name column + fixed Actions column, sized to fill the 480px dialog at
// comfortable density. Sorting/resize/visibility are off — short management list.
const helper = createColumnHelper<Layout>();
const layoutColumns = [
  helper.accessor("name", {
    id: "name",
    header: "Name",
    size: 200,
    enableSorting: false,
    meta: { grow: true },
  }),
  helper.display({ id: "actions", header: "Actions", size: 208, enableSorting: false }),
];

function isDefault(layout: Layout): boolean {
  return workspace.currentWorkspace?.defaultLayoutId === layout.id;
}

watch(
  () => props.visible,
  (open) => {
    if (open) {
      editingId.value = null;
      error.value = null;
    }
  },
);

function startRename(layout: Layout): void {
  editingId.value = layout.id;
  draftName.value = layout.name;
}

function cancelRename(): void {
  editingId.value = null;
}

async function saveRename(): Promise<void> {
  const id = editingId.value;
  if (!id) return;
  const name = draftName.value.trim();
  if (!name) return;
  await layoutStore.renameLayout(id, { name });
  editingId.value = null;
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
        A layout is a saved arrangement of panels in
        <span class="text-foreground font-medium">{{
          workspace.currentWorkspace?.name ?? "—"
        }}</span
        >. Rename a layout, set the one this workspace opens with (the default), duplicate it as a
        starting point, or delete it.
      </p>
      <p v-if="error" class="text-danger text-xs">{{ error }}</p>

      <DataTable
        :data="layoutStore.layouts"
        :columns="layoutColumns"
        row-key="id"
        :density="density"
        fluid
        :enable-sorting="false"
        :enable-column-resize="false"
        :enable-column-visibility="false"
        :enable-filtering="false"
        container-height="auto"
        empty-message="No layouts yet."
        class="border-border overflow-hidden rounded-md border"
      >
        <template #header-actions>
          <div class="w-full pr-1 text-right">Actions</div>
        </template>
        <template #cell-name="{ row }">
          <Input
            v-if="editingId === (row as Layout).id"
            v-model="draftName"
            v-focus
            class="w-full"
            @keydown.enter="saveRename"
            @keydown.esc="cancelRename"
          />
          <div v-else class="flex min-w-0 items-center gap-2">
            <span class="truncate">{{ (row as Layout).name }}</span>
            <Star
              v-if="isDefault(row as Layout)"
              class="text-accent-500 size-3.5 shrink-0 fill-current"
              aria-label="Workspace default"
            />
          </div>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex w-full items-center justify-end gap-1">
            <template v-if="editingId === (row as Layout).id">
              <Button size="sm" variant="primary" @click="saveRename">
                <Check class="size-3.5" />
                Save
              </Button>
              <Button size="sm" variant="secondary" @click="cancelRename">Cancel</Button>
            </template>
            <template v-else>
              <IconButton
                v-if="!isDefault(row as Layout)"
                label="Make default"
                size="sm"
                title="Make default"
                @click="makeDefault((row as Layout).id)"
              >
                <Star />
              </IconButton>
              <IconButton
                label="Rename"
                size="sm"
                title="Rename"
                @click="startRename(row as Layout)"
              >
                <Pencil />
              </IconButton>
              <IconButton
                label="Duplicate"
                size="sm"
                title="Duplicate"
                @click="duplicate((row as Layout).id)"
              >
                <Copy />
              </IconButton>
              <IconButton
                label="Delete"
                size="sm"
                title="Delete"
                :disabled="layoutStore.layouts.length <= 1"
                @click="remove((row as Layout).id)"
              >
                <Trash2 />
              </IconButton>
            </template>
          </div>
        </template>
      </DataTable>
    </div>
    <template #footer>
      <Button variant="primary" size="sm" @click="emit('update:visible', false)">Done</Button>
    </template>
  </Dialog>
</template>
