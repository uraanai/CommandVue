/* eslint-disable */
// Copy-paste template for adding a new preset type.
//
// 1. Define the config interface + the definition constant (this file).
// 2. Build the editor under src/components/presets/editors/MyPresetEditor.vue.
// 3. Register in src/modules/presets/builtin.ts (add to BUILTIN_PRESET_TYPES + export).
// 4. Ensure the panel(s) in applicableTo register their imperative handle via
//    registerPanelInstance on mount.

// ─── src/modules/presets/builtin.ts (or your extension) ───────────────────
/*
import type { PresetTypeDefinition } from "./types";
import { getPanelInstance } from "@/modules/panels/instances";

export interface MyPresetConfig extends Record<string, unknown> {
  url: string;
  color: string;
  opacity: number;
}

export const MY_PRESET: PresetTypeDefinition<MyPresetConfig> = {
  id: "my-preset",
  title: "My Preset",
  description: "What it does.",
  icon: "palette",
  applicableTo: ["maplibre"], // panel type ids
  defaultConfig: {
    url: "",
    color: "#10C4A2",
    opacity: 0.6,
  },
  editComponent: () =>
    import("@/components/presets/editors/MyPresetEditor.vue"),
  applyToPanel(panelId, config) {
    const handle = getPanelInstance<MyPanelHandle>(panelId);
    if (!handle) return; // panel not mounted yet — no-op gracefully
    handle.applyMyConfig(config);
  },
  removeFromPanel(panelId, config) {
    const handle = getPanelInstance<MyPanelHandle>(panelId);
    if (!handle) return;
    handle.removeMyConfig(config);
  },
};
*/

// ─── src/components/presets/editors/MyPresetEditor.vue ────────────────────
/*
<script setup lang="ts">
import type { MyPresetConfig } from "@/modules/presets/builtin";

import Input from "@/components/ui/Input.vue";

interface Props {
  modelValue: MyPresetConfig;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:modelValue": [value: MyPresetConfig] }>();

function update<K extends keyof MyPresetConfig>(
  key: K,
  value: MyPresetConfig[K],
): void {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-faint text-[10px] uppercase">URL</span>
      <Input
        :model-value="modelValue.url"
        type="url"
        @update:model-value="(v: string) => update('url', v)"
      />
    </label>
  </div>
</template>
*/

export {};
