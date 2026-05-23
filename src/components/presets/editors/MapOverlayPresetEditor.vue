<script setup lang="ts">
import type { MapOverlayConfig } from "@/modules/presets/builtin";

import Checkbox from "primevue/checkbox";
import ColorPicker from "primevue/colorpicker";
import Slider from "primevue/slider";
import { computed } from "vue";

import Input from "@/components/ui/Input.vue";
import { cn } from "@/utils/cn";

interface Props {
  modelValue: MapOverlayConfig;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:modelValue": [value: MapOverlayConfig] }>();

// PrimeVue ColorPicker returns hex without the leading "#"; our config stores
// it with the "#" prefix. Strip on write, prepend on read.
const colorHex = computed({
  get: () => props.modelValue.color.replace(/^#/, ""),
  set: (hex: string) => update("color", `#${hex}`),
});

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
          v-model="colorHex"
          format="hex"
          :pt="{
            preview: {
              class: cn('h-8 w-full rounded border border-border cursor-pointer'),
              style: { backgroundColor: modelValue.color },
            },
          }"
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
          :pt="{
            root: { class: 'relative h-2 rounded bg-surface-sunken my-3' },
            range: { class: 'absolute h-2 rounded bg-accent-500' },
            handle: {
              class: cn(
                'absolute -mt-1 h-4 w-4 -translate-x-1/2 rounded-full',
                'bg-accent-500 border-2 border-white shadow cursor-pointer',
              ),
            },
          }"
          @update:model-value="(v) => update('opacity', Array.isArray(v) ? (v[0] ?? 0) : (v ?? 0))"
        />
      </label>
    </div>
    <label class="flex items-center gap-2 text-sm">
      <Checkbox
        :model-value="modelValue.visible"
        binary
        input-id="map-overlay-visible"
        :pt="{
          box: {
            class: cn(
              'inline-flex h-4 w-4 items-center justify-center rounded border border-border bg-surface',
              'data-[p-checked=true]:bg-accent-600 data-[p-checked=true]:border-accent-600',
            ),
          },
          icon: { class: 'h-3 w-3 text-white' },
        }"
        @update:model-value="(v) => update('visible', !!v)"
      />
      <label for="map-overlay-visible">Visible by default</label>
    </label>
  </div>
</template>
