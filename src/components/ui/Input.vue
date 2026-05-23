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

const rootClass = computed(() =>
  cn(
    "block w-full rounded-md border bg-surface px-3 py-1.5 text-sm text-foreground",
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
