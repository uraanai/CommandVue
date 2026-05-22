<script setup lang="ts">
import type { Preset } from "@/types/preset";

import { ChevronRight, Copy, Globe, Layers, Pencil, Plus, Trash2 } from "@lucide/vue";
import { computed, ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import { presetTypeRegistry } from "@/modules/presets/registry";
import { usePresetStore } from "@/stores/preset";
import { useWorkspaceStore } from "@/stores/workspace";

import EditPresetDialog from "./EditPresetDialog.vue";

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
const showGlobal = ref(true);

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

const visiblePresets = computed(() =>
  showGlobal.value ? presetStore.globalPresets : presetStore.workspacePresets,
);

async function createOfType(typeId: string): Promise<void> {
  const def = presetTypeRegistry.get(typeId);
  if (!def) return;
  const workspaceId = showGlobal.value ? null : (workspace.currentWorkspaceId ?? null);
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
  // Promote workspace-scoped → global by duplicating with workspaceId: null.
  await presetStore.duplicatePreset(preset.id, { workspaceId: null });
}

async function scope(preset: Preset): Promise<void> {
  // Scope global → workspace by duplicating with the current workspace id.
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
</script>

<template>
  <Dialog
    :visible="visible"
    header="Manage presets"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded px-3 py-1 text-xs"
          :class="
            showGlobal
              ? 'bg-accent-600 text-white'
              : 'border-border text-muted hover:bg-surface-sunken border'
          "
          @click="showGlobal = true"
        >
          <Globe class="size-3" />
          Global ({{ presetStore.globalPresets.length }})
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded px-3 py-1 text-xs"
          :class="
            !showGlobal
              ? 'bg-accent-600 text-white'
              : 'border-border text-muted hover:bg-surface-sunken border'
          "
          @click="showGlobal = false"
        >
          <Layers class="size-3" />
          Workspace ({{ presetStore.workspacePresets.length }})
        </button>
      </div>

      <div class="border-border bg-surface-sunken rounded-md border p-3">
        <div class="text-faint mb-2 text-[10px] tracking-[0.18em] uppercase">Create new</div>
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

      <p v-if="error" class="text-danger text-xs">{{ error }}</p>

      <div class="border-border rounded-md border">
        <div v-if="visiblePresets.length === 0" class="text-muted px-3 py-6 text-center text-sm">
          No {{ showGlobal ? "global" : "workspace-scoped" }} presets yet.
        </div>
        <ul v-else class="divide-border divide-y">
          <li
            v-for="p in visiblePresets"
            :key="p.id"
            class="flex items-center gap-2 px-3 py-2 text-sm"
          >
            <div class="min-w-0 flex-1">
              <div class="text-foreground truncate font-medium">{{ p.name }}</div>
              <div class="text-faint text-xs">
                {{ presetTypeRegistry.get(p.presetTypeId)?.title ?? p.presetTypeId }}
                <template v-if="p.description"> · {{ p.description }}</template>
              </div>
            </div>
            <Button size="sm" variant="ghost" @click="startEdit(p)">
              <Pencil class="size-3.5" />
            </Button>
            <Button size="sm" variant="ghost" @click="duplicatePreset(p)">
              <Copy class="size-3.5" />
            </Button>
            <Button
              v-if="showGlobal && workspace.currentWorkspaceId"
              size="sm"
              variant="ghost"
              title="Copy to current workspace"
              @click="scope(p)"
            >
              <ChevronRight class="size-3.5" />
            </Button>
            <Button
              v-if="!showGlobal"
              size="sm"
              variant="ghost"
              title="Promote to global"
              @click="promote(p)"
            >
              <Globe class="size-3.5" />
            </Button>
            <Button size="sm" variant="ghost" @click="removePreset(p)">
              <Trash2 class="size-3.5" />
            </Button>
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <Button variant="primary" size="sm" @click="emit('update:visible', false)">Done</Button>
    </template>
  </Dialog>

  <EditPresetDialog v-model:visible="editOpen" :preset="editTarget" />
</template>
