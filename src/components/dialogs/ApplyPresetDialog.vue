<script setup lang="ts">
import type { Ulid } from "@/types/workspace";

import { computed, ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import { presetTypeRegistry } from "@/modules/presets/registry";
import { usePanelStateStore } from "@/stores/panelState";
import { usePresetStore } from "@/stores/preset";
import { useWorkspaceStore } from "@/stores/workspace";

interface Props {
  visible: boolean;
  panelId: null | Ulid;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const presetStore = usePresetStore();
const panelStateStore = usePanelStateStore();
const workspace = useWorkspaceStore();

const chosen = ref<null | Ulid>(null);

const panel = computed(() => (props.panelId ? panelStateStore.getState(props.panelId) : null));
const candidates = computed(() => {
  if (!panel.value?.panelType) return [];
  return presetStore.presetsForPanel(panel.value.panelType, workspace.currentWorkspaceId);
});

watch(
  () => props.visible,
  (open) => {
    if (open) chosen.value = candidates.value[0]?.id ?? null;
  },
);

async function apply(): Promise<void> {
  if (!props.panelId || !chosen.value) return;
  await presetStore.applyToPanel(props.panelId, chosen.value);
  emit("update:visible", false);
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Apply preset"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <div v-if="!panel" class="text-muted text-sm">No panel selected.</div>
    <div v-else-if="candidates.length === 0" class="text-muted text-sm">
      No presets are applicable to <span class="font-medium">{{ panel.panelType ?? "—" }}</span
      >.
    </div>
    <div v-else class="flex flex-col gap-2">
      <p class="text-faint text-[10px] tracking-[0.18em] uppercase">
        Available presets for {{ panel.panelType }}
      </p>
      <select
        v-model="chosen"
        class="border-border bg-surface text-foreground rounded-md border px-3 py-1.5 text-sm"
      >
        <option v-for="p in candidates" :key="p.id" :value="p.id">
          {{ p.name }} · {{ presetTypeRegistry.get(p.presetTypeId)?.title ?? p.presetTypeId }}
        </option>
      </select>
    </div>

    <template #footer>
      <Button variant="ghost" size="sm" @click="emit('update:visible', false)">Cancel</Button>
      <Button
        variant="primary"
        size="sm"
        :disabled="!chosen || candidates.length === 0"
        @click="apply"
      >
        Apply
      </Button>
    </template>
  </Dialog>
</template>
