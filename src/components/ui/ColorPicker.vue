<script setup lang="ts">
import PvColorPicker from "primevue/colorpicker";
import { computed } from "vue";

import { cn } from "@/utils/cn";

import { defaultColors, type PaletteColor } from "./colors";

/**
 * ColorPicker — hand-rolled wrapper over PrimeVue `ColorPicker` plus an
 * optional curated palette of swatches.
 *
 * Specialized exception under ADR 0002 Option C: kept in `src/components/ui/`
 * because (a) Volt's catalog as of 2026-05-24 has no `ColorPicker` and (b) the
 * project ships a curated palette concept (`defaultColors` in `./colors.ts`)
 * inspired by orbat-mapper's `colors.ts`, but built on PrimeVue rather than
 * `reka-ui`.
 *
 * Surface:
 *   - `v-model` (hex string with leading `#`)
 *   - `palette?` — array of named swatches; defaults to `defaultColors`
 *   - `showCustom?` — show the PrimeVue ColorPicker for arbitrary picks (default true)
 *   - `disabled?` / `format?` (passed through to PrimeVue)
 *
 * Layout: swatch grid above, custom-picker affordance below. The whole
 * component fits inside dialogs, popovers, or inline.
 */

interface Props {
  modelValue: string;
  palette?: readonly PaletteColor[];
  showCustom?: boolean;
  disabled?: boolean;
  format?: "hex" | "rgb" | "hsb";
}

const props = withDefaults(defineProps<Props>(), {
  palette: () => defaultColors,
  showCustom: true,
  disabled: false,
  format: "hex",
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const currentName = computed(() => {
  const match = props.palette.find((c) => c.hex.toLowerCase() === props.modelValue.toLowerCase());
  return match?.name ?? props.modelValue.toUpperCase();
});

function selectSwatch(hex: string): void {
  emit("update:modelValue", hex);
}

function onCustomChange(value: unknown): void {
  if (typeof value === "string") {
    emit("update:modelValue", value.startsWith("#") ? value : `#${value}`);
  }
}
</script>

<template>
  <div class="commandvue-colorpicker flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Color palette">
      <button
        v-for="swatch in palette"
        :key="swatch.hex"
        type="button"
        :title="swatch.name"
        :aria-label="swatch.name"
        :aria-checked="modelValue.toLowerCase() === swatch.hex.toLowerCase()"
        :disabled="disabled"
        role="radio"
        :class="
          cn(
            'size-5 rounded-full border transition-shadow',
            'focus-visible:ring-accent-500 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
            modelValue.toLowerCase() === swatch.hex.toLowerCase()
              ? 'ring-accent-500 border-foreground ring-2 ring-offset-1'
              : 'border-border hover:border-foreground/60',
            disabled && 'cursor-not-allowed opacity-50',
          )
        "
        :style="{ backgroundColor: swatch.hex }"
        @click="selectSwatch(swatch.hex)"
      />
    </div>

    <div v-if="showCustom" class="flex items-center gap-2 text-xs">
      <span class="text-muted">Custom:</span>
      <PvColorPicker
        :model-value="modelValue.replace(/^#/, '')"
        :format="format"
        :disabled="disabled"
        :pt="{
          root: { class: 'inline-flex items-center' },
          preview: {
            class: 'border-border h-5 w-8 cursor-pointer rounded border',
          },
        }"
        @update:model-value="onCustomChange"
      />
      <span class="text-foreground font-mono text-[11px]">{{ currentName }}</span>
    </div>
  </div>
</template>
