<script setup lang="ts">
import type { MapOverlayConfig } from "@/modules/presets/builtin";

import Input from "@/components/ui/Input.vue";

interface Props {
  modelValue: MapOverlayConfig;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:modelValue": [value: MapOverlayConfig] }>();

function update<K extends keyof MapOverlayConfig>(key: K, value: MapOverlayConfig[K]): void {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Name</span>
      <Input
        :model-value="modelValue.name"
        placeholder="Airspace boundaries"
        @update:model-value="(v: string) => update('name', v)"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-faint text-[10px] tracking-[0.18em] uppercase">GeoJSON URL</span>
      <Input
        :model-value="modelValue.geojsonUrl"
        type="url"
        placeholder="https://example/data.geojson"
        @update:model-value="(v: string) => update('geojsonUrl', v)"
      />
    </label>
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Color</span>
        <input
          :value="modelValue.color"
          type="color"
          class="border-border h-8 w-full rounded border"
          @input="(e) => update('color', (e.target as HTMLInputElement).value)"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Opacity</span>
        <input
          :value="modelValue.opacity"
          type="range"
          min="0"
          max="1"
          step="0.05"
          class="h-8"
          @input="(e) => update('opacity', Number((e.target as HTMLInputElement).value))"
        />
      </label>
    </div>
    <label class="flex items-center gap-2 text-sm">
      <input
        :checked="modelValue.visible"
        type="checkbox"
        class="accent-accent-600"
        @change="(e) => update('visible', (e.target as HTMLInputElement).checked)"
      />
      <span>Visible by default</span>
    </label>
  </div>
</template>
