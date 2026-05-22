<script setup lang="ts">
import { Check, Copy, Star, Trash2 } from "@lucide/vue";
import { ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import { useLayoutStore } from "@/stores/layout";
import { useWorkspaceStore } from "@/stores/workspace";

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const workspace = useWorkspaceStore();
const layoutStore = useLayoutStore();
const renaming = ref<string | null>(null);
const renameValue = ref("");
const error = ref<string | null>(null);

watch(
  () => props.visible,
  (open) => {
    if (open) {
      renaming.value = null;
      error.value = null;
    }
  },
);

function startRename(id: string, currentName: string): void {
  renaming.value = id;
  renameValue.value = currentName;
}

async function confirmRename(id: string): Promise<void> {
  if (!renameValue.value.trim()) return;
  await layoutStore.renameLayout(id, { name: renameValue.value.trim() });
  renaming.value = null;
}

async function makeDefault(id: string): Promise<void> {
  if (!workspace.currentWorkspaceId) return;
  await layoutStore.setDefaultForWorkspace(workspace.currentWorkspaceId, id);
  // Reload to pick up the new default
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
    @update:visible="(v) => emit('update:visible', v)"
  >
    <div class="flex flex-col gap-3">
      <p class="text-muted text-xs">
        Layouts in
        <span class="text-foreground font-medium">{{
          workspace.currentWorkspace?.name ?? "—"
        }}</span>
      </p>
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
              v-for="layout in layoutStore.layouts"
              :key="layout.id"
              class="border-border border-b last:border-b-0"
            >
              <td class="px-3 py-2">
                <div v-if="renaming === layout.id" class="flex items-center gap-1.5">
                  <Input v-model="renameValue" @keydown.enter="confirmRename(layout.id)" />
                  <Button size="sm" variant="primary" @click="confirmRename(layout.id)">
                    <Check class="size-3.5" />
                  </Button>
                </div>
                <div v-else class="flex items-center gap-2">
                  <button
                    type="button"
                    class="text-foreground hover:underline"
                    @click="startRename(layout.id, layout.name)"
                  >
                    {{ layout.name }}
                  </button>
                  <Star
                    v-if="workspace.currentWorkspace?.defaultLayoutId === layout.id"
                    class="text-accent-500 size-3.5"
                    aria-label="Workspace default"
                  />
                </div>
              </td>
              <td class="px-3 py-2 text-right">
                <div class="flex items-center justify-end gap-1">
                  <Button
                    v-if="workspace.currentWorkspace?.defaultLayoutId !== layout.id"
                    size="sm"
                    variant="ghost"
                    @click="makeDefault(layout.id)"
                  >
                    Make default
                  </Button>
                  <Button size="sm" variant="ghost" @click="duplicate(layout.id)">
                    <Copy class="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    :disabled="layoutStore.layouts.length <= 1"
                    @click="remove(layout.id)"
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
