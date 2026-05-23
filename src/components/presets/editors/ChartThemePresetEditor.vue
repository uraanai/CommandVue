<script setup lang="ts">
import type { ChartThemeConfig } from "@/modules/presets/builtin";

import { computed } from "vue";

import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";

interface Props {
  modelValue: ChartThemeConfig;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:modelValue": [value: ChartThemeConfig] }>();

const palette = computed(() => props.modelValue.colorPalette.join(", "));

const gridOptions = [
  { label: "Subtle", value: "subtle" },
  { label: "Bold", value: "bold" },
  { label: "None", value: "none" },
];

const tooltipOptions = [
  { label: "Axis", value: "axis" },
  { label: "Item", value: "item" },
];

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
      <Select
        :model-value="modelValue.gridStyle"
        :options="gridOptions"
        @update:model-value="(v) => update('gridStyle', v as ChartThemeConfig['gridStyle'])"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Tooltip mode</span>
      <Select
        :model-value="modelValue.tooltipMode"
        :options="tooltipOptions"
        @update:model-value="(v) => update('tooltipMode', v as ChartThemeConfig['tooltipMode'])"
      />
    </label>
  </div>
</template>
