<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/utils/cn";

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

const classes = computed(() =>
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
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :aria-invalid="invalid"
    :class="classes"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
