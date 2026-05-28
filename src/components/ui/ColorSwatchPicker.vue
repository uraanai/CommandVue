<script setup lang="ts">
import { converter, formatCss } from "culori";
import { computed, ref } from "vue";

import { cn } from "@/utils/cn";

/**
 * ColorSwatchPicker — OKLCH-typed swatch grid with an optional custom-color
 * popover. Used by the Phase E theme customizer for base and accent inputs.
 *
 * Why a second picker alongside `src/components/ui/ColorPicker.vue`? That one
 * is hex-typed and ships a curated *operational* palette (entity colors,
 * symbology). The theme generator works in OKLCH and needs a different
 * curation (engine-friendly base / accent ranges) — duplicating the curated
 * arrays into the hex picker would mean hex→OKLCH conversion on every
 * generator call. Keeping the two pickers separate by color-space and
 * intent is cleaner; both live in `src/components/ui/` per ADR 0002.
 *
 * Surface:
 *   - `v-model` — OKLCH CSS string, e.g. `oklch(0.55 0.18 250)`.
 *   - `options` — curated swatches to render in the grid (label + OKLCH value).
 *   - `allowCustom` — if true (default), show a "+" affordance that opens a
 *     popover with a native `<input type="color">`. Hex → OKLCH conversion
 *     runs on change so consumers always see an OKLCH value.
 *
 * The popover is intentionally cheap (no floating-ui, no Volt Popover) — the
 * trigger button just toggles a `<details>`-style absolute panel anchored
 * below the trigger. Good enough for inside a dialog.
 */

interface Option {
  label: string;
  value: string;
}

interface Props {
  modelValue: string;
  options: readonly Option[];
  allowCustom?: boolean;
  /** Visually-hidden label used for the radiogroup's aria-label. */
  ariaLabel?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  allowCustom: true,
  ariaLabel: "Color",
  disabled: false,
});

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const toOklch = converter("oklch");

const isSelected = (value: string): boolean =>
  // Compare on the formatted string — handles spacing / precision variance
  // between options (curated) and the model value (might be a custom pick).
  props.modelValue.replace(/\s+/g, "") === value.replace(/\s+/g, "");

const customLabel = computed(() => {
  // Show "Custom" when the active value isn't one of the curated options.
  const isCurated = props.options.some((o) => isSelected(o.value));
  return isCurated ? null : props.modelValue;
});

function select(value: string): void {
  if (props.disabled) return;
  emit("update:modelValue", value);
}

// --- Custom-color popover ---------------------------------------------------

const popoverOpen = ref(false);
const hexInput = ref<HTMLInputElement | null>(null);

function openCustomPicker(): void {
  if (props.disabled) return;
  popoverOpen.value = true;
  // Native color picker — let the browser raise it on next tick.
  void Promise.resolve().then(() => hexInput.value?.click());
}

function onCustomChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  const hex = target.value; // "#rrggbb"
  const oklch = toOklch(hex);
  if (oklch) {
    emit("update:modelValue", formatCss(oklch));
  }
  popoverOpen.value = false;
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <div
      class="flex flex-wrap items-center gap-1.5"
      role="radiogroup"
      :aria-label="props.ariaLabel"
    >
      <button
        v-for="opt in props.options"
        :key="opt.value"
        type="button"
        role="radio"
        :title="opt.label"
        :aria-label="opt.label"
        :aria-checked="isSelected(opt.value)"
        :disabled="props.disabled"
        :class="
          cn(
            'size-6 rounded-full border transition-all',
            'focus-visible:ring-accent-500 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
            isSelected(opt.value)
              ? 'ring-accent-500 border-foreground ring-2 ring-offset-1'
              : 'border-border hover:border-foreground/60',
            props.disabled && 'cursor-not-allowed opacity-50',
          )
        "
        :style="{ backgroundColor: opt.value }"
        @click="select(opt.value)"
      />
    </div>

    <button
      v-if="props.allowCustom"
      type="button"
      :title="'Custom color' + (customLabel ? ` (${customLabel})` : '')"
      :aria-label="'Pick a custom color'"
      :disabled="props.disabled"
      :class="
        cn(
          'border-border text-muted hover:border-foreground/60 hover:text-foreground flex size-6 items-center justify-center rounded-full border text-[14px] leading-none transition-colors',
          'focus-visible:ring-accent-500 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
          customLabel && 'ring-accent-500 border-foreground ring-2 ring-offset-1',
          props.disabled && 'cursor-not-allowed opacity-50',
        )
      "
      :style="customLabel ? { backgroundColor: props.modelValue } : undefined"
      @click="openCustomPicker"
    >
      <span v-if="!customLabel" aria-hidden="true">+</span>
    </button>

    <!-- Hidden native color input. We trigger it via .click() to use the
         browser's native swatch UI; on change we convert hex → OKLCH so the
         model always sees an OKLCH string. Kept in the DOM (not v-if) so
         hexInput.value is always wired. -->
    <input
      ref="hexInput"
      type="color"
      class="pointer-events-none absolute size-0 opacity-0"
      :aria-hidden="true"
      tabindex="-1"
      :value="(customLabel || props.modelValue).startsWith('#') ? props.modelValue : '#888888'"
      @change="onCustomChange"
    />
  </div>
</template>
