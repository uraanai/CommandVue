<script setup lang="ts">
import type { Workspace } from "@/types/workspace";

import { Check, Pencil, Plus, Star, Trash2 } from "@lucide/vue";
import { computed, ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import DataTable from "@/components/ui/DataTable.vue";
import { createColumnHelper } from "@/components/ui/datatable/columnHelpers";
import IconButton from "@/components/ui/IconButton.vue";
import Input from "@/components/ui/Input.vue";
import { useNotify } from "@/composables/useNotify";
import {
  makeCreateWorkspaceCommand,
  makeDeleteWorkspaceCommand,
  makeRenameWorkspaceCommand,
  makeSetGlobalDefaultWorkspaceCommand,
} from "@/modules/history/adapters";
import { useHistoryStore } from "@/stores/history";
import { useThemeStore } from "@/stores/theme";
import { useWorkspaceStore } from "@/stores/workspace";
import Dialog from "@/volt/Dialog.vue";

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const workspace = useWorkspaceStore();
const themeStore = useThemeStore();
const history = useHistoryStore();
const notify = useNotify();
const newName = ref("");
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

// Density follows the active theme (themeStore.currentTheme.density), the same
// single source of truth EntityListPanel uses — cell padding then resolves from
// the wrapper's --density-* tokens, so rows track the global density mode.
const density = computed(() => themeStore.currentTheme?.density ?? "comfortable");

// Flexible Name column + fixed Actions column, sized to fill the 480px dialog at
// comfortable density. Sorting/resize/visibility are off — short management list.
const helper = createColumnHelper<Workspace>();
const workspaceColumns = [
  helper.accessor("name", {
    id: "name",
    header: "Name",
    size: 200,
    enableSorting: false,
    meta: { grow: true },
  }),
  helper.display({ id: "actions", header: "Actions", size: 184, enableSorting: false }),
];

watch(
  () => props.visible,
  (open) => {
    if (open) {
      newName.value = "";
      error.value = null;
      editingId.value = null;
    }
  },
);

async function create(): Promise<void> {
  const name = newName.value.trim();
  if (!name) return;
  error.value = null;
  try {
    // One undoable step: creates the workspace AND its mandatory first layout
    // (undo deletes both).
    await history.execute(makeCreateWorkspaceCommand(name));
    newName.value = "";
    notify.success("Workspace created", { detail: `“${name}” is ready.` });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    notify.danger("Couldn’t create workspace", { detail: error.value });
  }
}

function startRename(ws: Workspace): void {
  editingId.value = ws.id;
  draftName.value = ws.name;
}

function cancelRename(): void {
  editingId.value = null;
}

async function saveRename(): Promise<void> {
  const id = editingId.value;
  if (!id) return;
  const name = draftName.value.trim();
  if (!name) return;
  try {
    await history.execute(makeRenameWorkspaceCommand(id, name));
    notify.success("Workspace renamed", { detail: `Now “${name}”.` });
  } catch (e) {
    notify.danger("Couldn’t rename workspace", {
      detail: e instanceof Error ? e.message : String(e),
    });
  }
  editingId.value = null;
}

async function makeDefault(id: string): Promise<void> {
  try {
    await history.execute(makeSetGlobalDefaultWorkspaceCommand(id));
    notify.success("Default workspace updated");
  } catch (e) {
    notify.danger("Couldn’t set default", { detail: e instanceof Error ? e.message : String(e) });
  }
}

async function remove(id: string): Promise<void> {
  error.value = null;
  try {
    await history.execute(makeDeleteWorkspaceCommand(id));
    notify.success("Workspace deleted");
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    notify.danger("Couldn’t delete workspace", { detail: error.value });
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Manage workspaces"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div class="flex flex-col gap-3">
      <p class="text-muted text-xs">
        A workspace is an independent set of layouts with its own saved panels and theme. Create a
        new one, rename it, set the default that opens at launch, or delete it.
      </p>
      <div class="flex flex-col gap-1">
        <span class="text-faint text-[10px] tracking-[0.18em] uppercase">New workspace</span>
        <!-- items-stretch makes the Create button match the input's height exactly at
             every density; the eyebrow label is hoisted out of the row so it doesn't
             stretch the button to the label's height too. -->
        <div class="flex items-stretch gap-2">
          <Input
            v-model="newName"
            placeholder="Workspace name"
            class="flex-1"
            @keydown.enter="create"
          />
          <Button variant="primary" size="sm" :disabled="!newName.trim()" @click="create">
            <Plus class="size-3.5" />
            Create
          </Button>
        </div>
      </div>
      <p v-if="error" class="text-danger text-xs">{{ error }}</p>

      <DataTable
        :data="workspace.workspaces"
        :columns="workspaceColumns"
        row-key="id"
        :density="density"
        fluid
        :enable-sorting="false"
        :enable-column-resize="false"
        :enable-column-visibility="false"
        :enable-filtering="false"
        container-height="auto"
        empty-message="No workspaces yet."
        class="border-border overflow-hidden rounded-md border"
      >
        <template #header-actions>
          <div class="w-full pr-1 text-right">Actions</div>
        </template>
        <template #cell-name="{ row }">
          <Input
            v-if="editingId === (row as Workspace).id"
            v-model="draftName"
            v-focus
            class="w-full"
            @keydown.enter="saveRename"
            @keyup.esc="cancelRename"
          />
          <div v-else class="flex min-w-0 items-center gap-2">
            <span class="truncate">{{ (row as Workspace).name }}</span>
            <Star
              v-if="(row as Workspace).isGlobalDefault"
              class="text-accent-500 size-3.5 shrink-0 fill-current"
              aria-label="Global default"
            />
          </div>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex w-full items-center justify-end gap-1">
            <template v-if="editingId === (row as Workspace).id">
              <Button size="sm" variant="primary" @click="saveRename">
                <Check class="size-3.5" />
                Save
              </Button>
              <Button size="sm" variant="secondary" @click="cancelRename">Cancel</Button>
            </template>
            <template v-else>
              <IconButton
                v-if="!(row as Workspace).isGlobalDefault"
                label="Make default"
                size="sm"
                title="Make default"
                @click="makeDefault((row as Workspace).id)"
              >
                <Star />
              </IconButton>
              <IconButton
                label="Rename"
                size="sm"
                title="Rename"
                @click="startRename(row as Workspace)"
              >
                <Pencil />
              </IconButton>
              <IconButton
                label="Delete"
                size="sm"
                title="Delete"
                :disabled="workspace.workspaces.length <= 1"
                @click="remove((row as Workspace).id)"
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
