<script setup lang="ts">
import type { MapOverlayConfig } from "@/modules/presets/builtin";

import ColorPicker from "@/components/ui/ColorPicker.vue";
import Input from "@/components/ui/Input.vue";
import Checkbox from "@/volt/Checkbox.vue";
import Slider from "@/volt/Slider.vue";

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
        <ColorPicker
          :model-value="modelValue.color"
          @update:model-value="(v: string) => update('color', v)"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-faint text-[10px] tracking-[0.18em] uppercase">
          Opacity ({{ Math.round(modelValue.opacity * 100) }}%)
        </span>
        <Slider
          :model-value="modelValue.opacity"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="
            (v: number | number[]) => update('opacity', Array.isArray(v) ? (v[0] ?? 0) : (v ?? 0))
          "
        />
      </label>
    </div>
    <label class="flex items-center gap-2 text-sm">
      <Checkbox
        :model-value="modelValue.visible"
        binary
        input-id="map-overlay-visible"
        @update:model-value="(v: boolean | unknown) => update('visible', !!v)"
      />
      <label for="map-overlay-visible">Visible by default</label>
    </label>
  </div>
</template>
