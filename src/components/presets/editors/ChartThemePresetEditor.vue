<script setup lang="ts">
import type { ChartThemeConfig } from "@/modules/presets/builtin";

import { computed } from "vue";

import Input from "@/components/ui/Input.vue";

interface Props {
  modelValue: ChartThemeConfig;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:modelValue": [value: ChartThemeConfig] }>();

const palette = computed(() => props.modelValue.colorPalette.join(", "));

function update<K extends keyof ChartThemeConfig>(key: K, value: ChartThemeConfig[K]): void {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}

function updatePalette(raw: string): void {
  const colors = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  update("colorPalette", colors);
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-faint text-[10px] tracking-[0.18em] uppercase"
        >Color palette (comma-separated hex)</span
      >
      <Input
        :model-value="palette"
        placeholder="#10C4A2, #0EA5E9, #F59E0B"
        @update:model-value="updatePalette"
      />
      <div class="flex gap-1.5 pt-1">
        <span
          v-for="(c, idx) in modelValue.colorPalette"
          :key="idx"
          class="border-border h-5 w-5 rounded border"
          :style="{ backgroundColor: c }"
        />
      </div>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Grid style</span>
      <select
        :value="modelValue.gridStyle"
        class="border-border bg-surface text-foreground rounded-md border px-3 py-1.5 text-sm"
        @change="
          (e) =>
            update(
              'gridStyle',
              (e.target as HTMLSelectElement).value as ChartThemeConfig['gridStyle'],
            )
        "
      >
        <option value="subtle">Subtle</option>
        <option value="bold">Bold</option>
        <option value="none">None</option>
      </select>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Tooltip mode</span>
      <select
        :value="modelValue.tooltipMode"
        class="border-border bg-surface text-foreground rounded-md border px-3 py-1.5 text-sm"
        @change="
          (e) =>
            update(
              'tooltipMode',
              (e.target as HTMLSelectElement).value as ChartThemeConfig['tooltipMode'],
            )
        "
      >
        <option value="axis">Axis</option>
        <option value="item">Item</option>
      </select>
    </label>
  </div>
</template>
