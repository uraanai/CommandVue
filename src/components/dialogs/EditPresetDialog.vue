<script setup lang="ts">
import type { Preset } from "@/types/preset";

import { computed, defineAsyncComponent, ref, watch } from "vue";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Input from "@/components/ui/Input.vue";
import { presetTypeRegistry } from "@/modules/presets/registry";
import { usePresetStore } from "@/stores/preset";

interface Props {
  visible: boolean;
  preset: null | Preset;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const presetStore = usePresetStore();
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
      config.value = structuredClone(props.preset.config);
    }
  },
  { immediate: true },
);

function close(): void {
  emit("update:visible", false);
}

async function save(): Promise<void> {
  if (!props.preset || !name.value.trim()) return;
  await presetStore.updatePreset(props.preset.id, {
    name: name.value.trim(),
    description: description.value.trim() || undefined,
    config: config.value,
  });
  close();
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="preset ? `Edit preset · ${typeDef?.title ?? preset.presetTypeId}` : 'Edit preset'"
    @update:visible="(v) => emit('update:visible', v)"
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
      <Button variant="ghost" size="sm" @click="close">Cancel</Button>
      <Button variant="primary" size="sm" :disabled="!name.trim()" @click="save">Save</Button>
    </template>
  </Dialog>
</template>
