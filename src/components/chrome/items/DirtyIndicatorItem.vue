<script setup lang="ts">
import { Circle } from "@lucide/vue";

import { useSessionStore } from "@/stores/session";

const session = useSessionStore();
</script>

<template>
  <span
    v-if="session.dirty"
    class="text-accent-500 flex items-center gap-1 text-xs"
    title="Unsaved changes"
  >
    <Circle class="size-2 fill-current" />
    <span>Unsaved</span>
  </span>
</template>
