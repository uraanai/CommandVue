<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/utils/cn";

interface Tab {
  id: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  modelValue: string;
  tabs: Tab[];
}

const props = defineProps<Props>();

defineEmits<{
  "update:modelValue": [value: string];
}>();

const listClass = computed(() => cn("flex items-center gap-1 border-b border-border"));

function tabClass(tab: Tab) {
  const isActive = tab.id === props.modelValue;
  return cn(
    "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2",
    isActive
      ? "border-accent-500 text-foreground"
      : "border-transparent text-muted hover:text-foreground hover:bg-surface-raised",
    tab.disabled && "cursor-not-allowed opacity-50",
  );
}
</script>

<template>
  <div>
    <div role="tablist" :class="listClass">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="tab.id === modelValue"
        :disabled="tab.disabled"
        :class="tabClass(tab)"
        @click="!tab.disabled && $emit('update:modelValue', tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="pt-3">
      <slot :active="modelValue" />
    </div>
  </div>
</template>
