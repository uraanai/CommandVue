<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/utils/cn";

interface Option {
  label: string;
  value: string | number;
  disabled?: boolean;
}

interface Props {
  modelValue?: string | number;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  placeholder: undefined,
  disabled: false,
});

defineEmits<{
  "update:modelValue": [value: string | number];
}>();

const classes = computed(() =>
  cn(
    "block w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ),
);
</script>

<template>
  <select
    :value="modelValue"
    :disabled="disabled"
    :class="classes"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-if="placeholder" value="" disabled :selected="modelValue === undefined">
      {{ placeholder }}
    </option>
    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :disabled="option.disabled"
    >
      {{ option.label }}
    </option>
  </select>
</template>
