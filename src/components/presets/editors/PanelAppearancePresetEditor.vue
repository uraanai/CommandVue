<script setup lang="ts">
import type { PanelAppearanceConfig } from "@/modules/presets/panelAppearance";

import Select from "@/components/ui/Select.vue";
import { PANEL_APPEARANCE_VARIANTS } from "@/modules/presets/panelAppearance";

/**
 * Edit UI for the `panel-appearance` preset (Track A C4). One Select of the
 * four frame variants + a perf note for `glass`. Mirrors MapStylePresetEditor's
 * forward-only v-model emit; uses `ui/Select`'s `{ label, value }[]` API.
 */
interface Props {
  modelValue: PanelAppearanceConfig;
}
const props = defineProps<Props>();
const emit = defineEmits<{ "update:modelValue": [value: PanelAppearanceConfig] }>();

const VARIANT_OPTIONS = PANEL_APPEARANCE_VARIANTS.map((v) => ({
  label: v.charAt(0).toUpperCase() + v.slice(1),
  value: v,
}));

function onVariant(v: null | number | string): void {
  if (v == null) return;
  emit("update:modelValue", {
    ...props.modelValue,
    variant: v as PanelAppearanceConfig["variant"],
  });
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-faint text-[10px] tracking-[0.18em] uppercase">Appearance</span>
      <Select
        :model-value="modelValue.variant"
        :options="VARIANT_OPTIONS"
        @update:model-value="onVariant"
      />
    </label>
    <p v-if="modelValue.variant === 'glass'" class="text-faint text-xs">
      Glass uses a GPU backdrop blur where supported. Over a live map it can cost frames, and it
      does not blur a WebGL canvas inside the same panel. Use sparingly.
    </p>
  </div>
</template>
