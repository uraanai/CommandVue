<script setup lang="ts">
import { Inbox } from "@lucide/vue";

defineProps<{
  title?: string;
  description?: string;
}>();
</script>

<template>
  <div
    class="bg-surface-sunken flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center"
  >
    <slot name="icon">
      <Inbox class="text-faint size-8" />
    </slot>
    <h3 v-if="title" class="text-foreground text-sm font-medium">{{ title }}</h3>
    <p v-if="description" class="text-muted max-w-prose text-xs">{{ description }}</p>
    <slot name="action" />
  </div>
</template>
