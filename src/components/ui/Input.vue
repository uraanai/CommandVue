<script setup lang="ts">
import InputText from "primevue/inputtext";
import { computed } from "vue";

import { cn } from "@/utils/cn";

/**
 * Input — thin wrapper over PrimeVue InputText. The public API is preserved
 * from the previous hand-rolled version so callers don't change.
 *
 * For specialized types (number, color, range, password, etc.) prefer the
 * dedicated PrimeVue component (`InputNumber`, `ColorPicker`, `Slider`,
 * `Password`) directly — this wrapper covers text/search/email/url only.
 */
interface Props {
  modelValue?: string;
  type?: "text" | "search" | "email" | "url" | "number" | "password";
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  type: "text",
  placeholder: undefined,
  disabled: false,
  invalid: false,
});

defineEmits<{
  "update:modelValue": [value: string];
}>();

// Padding + font-size + min-height all driven by the `--density-*` tokens so
// the input rescales with `data-density` on `<html>`.
const rootClass = computed(() =>
  cn(
    "block w-full rounded-md border bg-surface text-foreground",
    "px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)]",
    "text-[length:var(--density-font-size)] min-h-[var(--density-control-height)]",
    "placeholder:text-faint",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-0",
    "disabled:cursor-not-allowed disabled:opacity-50",
    props.invalid ? "border-danger" : "border-border",
  ),
);
</script>

<template>
  <InputText
    :model-value="modelValue"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :aria-invalid="invalid"
    :pt="{ root: { class: rootClass } }"
    @update:model-value="(v) => $emit('update:modelValue', String(v ?? ''))"
  />
</template>
