<script setup lang="ts">
import type { MapStyleConfig } from "@/modules/presets/builtin";

import Input from "@/components/ui/Input.vue";

interface Props {
  modelValue: MapStyleConfig;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:modelValue": [value: MapStyleConfig] }>();

function update<K extends keyof MapStyleConfig>(key: K, value: MapStyleConfig[K]): void {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Style URL</span>
      <Input
        :model-value="modelValue.styleUrl"
        type="url"
        placeholder="https://tiles.example/style.json"
        @update:model-value="(v: string) => update('styleUrl', v)"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Attribution (optional)</span>
      <Input
        :model-value="modelValue.attribution ?? ''"
        placeholder="© Style provider"
        @update:model-value="(v: string) => update('attribution', v || undefined)"
      />
    </label>
  </div>
</template>
