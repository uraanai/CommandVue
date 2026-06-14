<script setup lang="ts">
import type { Preset } from "@/types/preset";

import { computed, defineAsyncComponent, ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import { makeUpdatePresetCommand } from "@/modules/history/adapters";
import { presetTypeRegistry } from "@/modules/presets/registry";
import { useHistoryStore } from "@/stores/history";
import Dialog from "@/volt/Dialog.vue";

interface Props {
  visible: boolean;
  preset: null | Preset;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const history = useHistoryStore();
const name = ref("");
const description = ref("");
const config = ref<Record<string, unknown>>({});

const typeDef = computed(() =>
  props.preset ? presetTypeRegistry.get(props.preset.presetTypeId) : undefined,
);

const editComponent = computed(() => {
  if (!typeDef.value) return null;
  return defineAsyncComponent(typeDef.value.editComponent);
});

watch(
  () => [props.visible, props.preset?.id] as const,
  ([open, _id]) => {
    void _id;
    if (open && props.preset) {
      name.value = props.preset.name;
      description.value = props.preset.description ?? "";
      // JSON round-trip (not `structuredClone`) because `props.preset.config`
      // arrives as a Vue reactive proxy, which `structuredClone` rejects with
      // DataCloneError. A JSON clone strips the proxy at every depth and yields a
      // plain, detached copy the edit form can mutate without touching the stored
      // record. Safe because preset configs are JSON-serializable by contract
      // (they round-trip through idb).
      config.value = JSON.parse(JSON.stringify(props.preset.config)) as Record<string, unknown>;
    }
  },
  { immediate: true },
);

function close(): void {
  emit("update:visible", false);
}

async function save(): Promise<void> {
  if (!props.preset || !name.value.trim()) return;
  await history.execute(
    makeUpdatePresetCommand(props.preset.id, {
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      config: config.value,
    }),
  );
  close();
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="preset ? `Edit preset · ${typeDef?.title ?? preset.presetTypeId}` : 'Edit preset'"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <div v-if="preset" class="flex flex-col gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Name</span>
        <Input v-model="name" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Description</span>
        <Input v-model="description" />
      </label>
      <hr class="border-border" />
      <component :is="editComponent" v-if="editComponent" v-model="config" />
      <p v-else class="text-muted text-xs">No editor registered for this preset type.</p>
    </div>
    <template #footer>
      <Button variant="secondary" size="sm" @click="close">Cancel</Button>
      <Button variant="primary" size="sm" :disabled="!name.trim()" @click="save">Save</Button>
    </template>
  </Dialog>
</template>
