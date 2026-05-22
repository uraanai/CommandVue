<script setup lang="ts">
import { Check, Plus, Star, Trash2 } from "@lucide/vue";
import { ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import { layoutRepo } from "@/modules/storage/layoutRepo";
import { useWorkspaceStore } from "@/stores/workspace";

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const workspace = useWorkspaceStore();
const newName = ref("");
const renaming = ref<string | null>(null);
const renameValue = ref("");
const error = ref<string | null>(null);

watch(
  () => props.visible,
  (open) => {
    if (open) {
      newName.value = "";
      renaming.value = null;
      error.value = null;
    }
  },
);

async function create(): Promise<void> {
  if (!newName.value.trim()) return;
  error.value = null;
  try {
    const ws = await workspace.createWorkspace({ name: newName.value.trim() });
    // Newly created workspaces need at least one layout to satisfy invariant 6
    // before the user can switch into them — auto-create a "Default" layout.
    await layoutRepo.create({ workspaceId: ws.id, name: "Default" });
    newName.value = "";
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

function startRename(id: string, currentName: string): void {
  renaming.value = id;
  renameValue.value = currentName;
}

async function confirmRename(id: string): Promise<void> {
  if (!renameValue.value.trim()) return;
  await workspace.renameWorkspace(id, { name: renameValue.value.trim() });
  renaming.value = null;
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
      <div class="border-border rounded-md border">
        <table class="w-full text-sm">
          <thead class="text-faint text-[10px] tracking-[0.18em] uppercase">
            <tr class="border-border border-b">
              <th class="px-3 py-2 text-left">Name</th>
              <th class="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ws in workspace.workspaces"
              :key="ws.id"
              class="border-border border-b last:border-b-0"
            >
              <td class="px-3 py-2">
                <div v-if="renaming === ws.id" class="flex items-center gap-1.5">
                  <Input v-model="renameValue" @keydown.enter="confirmRename(ws.id)" />
                  <Button size="sm" variant="primary" @click="confirmRename(ws.id)">
                    <Check class="size-3.5" />
                  </Button>
                </div>
                <div v-else class="flex items-center gap-2">
                  <button
                    type="button"
                    class="text-foreground hover:underline"
                    @click="startRename(ws.id, ws.name)"
                  >
                    {{ ws.name }}
                  </button>
                  <Star
                    v-if="ws.isGlobalDefault"
                    class="text-accent-500 size-3.5"
                    aria-label="Global default"
                  />
                </div>
              </td>
              <td class="px-3 py-2 text-right">
                <div class="flex items-center justify-end gap-1">
                  <Button
                    v-if="!ws.isGlobalDefault"
                    size="sm"
                    variant="ghost"
                    @click="makeDefault(ws.id)"
                  >
                    Make default
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    :disabled="workspace.workspaces.length <= 1"
                    @click="remove(ws.id)"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <template #footer>
      <Button variant="primary" size="sm" @click="emit('update:visible', false)">Done</Button>
    </template>
  </Dialog>
</template>
