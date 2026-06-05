<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";
import { converter, formatCss } from "culori";
import { ref, watch } from "vue";

import Input from "@/components/ui/Input.vue";
import { TokenValueSchema } from "@/modules/themes/portableSchema";
import { cn } from "@/utils/cn";
import InputNumber from "@/volt/InputNumber.vue";

/**
 * TokenColorField — OKLCH-aware single-token color control (Track A C1).
 *
 * Why custom (not ui/ColorSwatchPicker): that picker needs a non-empty curated
 * `options` grid and its custom path is an sRGB-hex `<input type="color">` — it
 * cannot author the ~70 arbitrary color tokens, gamut-clamps wide-gamut OKLCH on
 * every pick, and cannot preserve `color-mix()` / `var()` defaults. This control
 * takes no options, seeds from a computed resolved value, edits in OKLCH (or raw
 * via Advanced), and preserves an unedited value verbatim. There is NO
 * `<input type="color">` here. Token-pure; lives under panels/ (not scanned by
 * check:single-source) — the one raw element is the custom swatch trigger.
 */
interface Props {
  /** Computed resolved CSS value for this token (getComputedStyle(APP_ROOT)). Seeds the control. */
  resolvedValue: string;
  /** True when an override exists for this token. */
  edited: boolean;
  /** Accessible name for the swatch trigger. */
  label: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{ change: [value: string] }>();

const toOklch = converter("oklch");

const open = ref(false);
const root = ref<HTMLElement | null>(null);
onClickOutside(root, () => (open.value = false));

const l = ref(0.7);
const c = ref(0);
const h = ref(0);
const parsedOklch = ref(false);
const advanced = ref("");
const advancedError = ref(false);

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function seed(): void {
  const parsed = toOklch(props.resolvedValue);
  if (parsed) {
    l.value = round(parsed.l ?? 0, 4);
    c.value = round(parsed.c ?? 0, 4);
    h.value = Math.round(parsed.h ?? 0);
    parsedOklch.value = true;
  } else {
    // Unresolvable (e.g. a var() chain) → neutral seed; the user edits raw.
    l.value = 0.7;
    c.value = 0;
    h.value = 0;
    parsedOklch.value = false;
  }
  advanced.value = props.resolvedValue;
  advancedError.value = false;
}

// Re-seed when the resolved value changes from outside (e.g. a reset), but only
// while the popover is closed so an open edit isn't clobbered mid-stroke.
watch(
  () => props.resolvedValue,
  () => {
    if (!open.value) seed();
  },
  { immediate: true },
);

function toggle(): void {
  if (!open.value) seed();
  open.value = !open.value;
}

function onChannel(channel: "l" | "c" | "h", value: number | null): void {
  const n = value ?? 0;
  if (channel === "l") l.value = n;
  else if (channel === "c") c.value = n;
  else h.value = n;
  emit("change", formatCss({ mode: "oklch", l: l.value, c: c.value, h: h.value }));
}

function commitAdvanced(): void {
  const v = advanced.value.trim();
  if (!TokenValueSchema.safeParse(v).success) {
    advancedError.value = true;
    return;
  }
  advancedError.value = false;
  emit("change", v);
}
</script>

<template>
  <div ref="root" class="relative inline-flex">
    <!-- eslint-disable-next-line vue/no-restricted-html-elements -- custom color swatch trigger (mirrors ui/ColorSwatchPicker); not a Button surface -->
    <button
      type="button"
      :aria-label="label"
      :title="resolvedValue"
      :class="
        cn(
          'size-6 rounded-md border transition-shadow',
          'focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:ring-offset-1 focus-visible:outline-none',
          edited ? 'border-foreground' : 'border-border hover:border-foreground/60',
        )
      "
      :style="{ backgroundColor: resolvedValue }"
      @click="toggle"
    />

    <div
      v-if="open"
      class="border-border bg-surface-raised absolute top-full left-0 z-50 mt-1 flex w-60 flex-col gap-2 rounded-md border p-3 shadow-lg"
    >
      <span class="text-faint text-[10px] tracking-wider uppercase">OKLCH</span>
      <label class="flex items-center gap-2 text-xs">
        <span class="text-muted w-3 shrink-0">L</span>
        <InputNumber
          :model-value="l"
          :min="0"
          :max="1"
          :step="0.01"
          :max-fraction-digits="4"
          @update:model-value="(v: number | null) => onChannel('l', v)"
        />
      </label>
      <label class="flex items-center gap-2 text-xs">
        <span class="text-muted w-3 shrink-0">C</span>
        <InputNumber
          :model-value="c"
          :min="0"
          :max="0.4"
          :step="0.005"
          :max-fraction-digits="4"
          @update:model-value="(v: number | null) => onChannel('c', v)"
        />
      </label>
      <label class="flex items-center gap-2 text-xs">
        <span class="text-muted w-3 shrink-0">H</span>
        <InputNumber
          :model-value="h"
          :min="0"
          :max="360"
          :step="1"
          @update:model-value="(v: number | null) => onChannel('h', v)"
        />
      </label>
      <p v-if="!parsedOklch" class="text-faint text-[10px] leading-snug">
        Current value isn't OKLCH — edit it raw below, or use the channels above to overwrite.
      </p>

      <span class="text-faint mt-1 text-[10px] tracking-wider uppercase">Advanced</span>
      <Input
        v-model="advanced"
        :invalid="advancedError"
        :title="advancedError ? 'Invalid or unsafe value' : 'oklch(), color-mix(), var(), #hex…'"
        spellcheck="false"
        @keyup.enter="commitAdvanced"
        @blur="commitAdvanced"
      />
    </div>
  </div>
</template>
