<script setup lang="ts">
import { X } from "@lucide/vue";

import Button from "@/components/ui/Button.vue";
import { useChromeStore } from "@/stores/chrome";

const chrome = useChromeStore();
</script>

<template>
  <div
    v-if="chrome.editMode"
    class="border-accent-500 bg-accent-500 pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between border-b px-3 py-1 text-xs text-white"
  >
    <span class="pointer-events-none flex items-center gap-2">
      <span class="font-medium">Chrome edit mode</span>
      <span class="opacity-80">
        Click <span class="font-mono">+</span> to add items, the
        <span class="font-mono">×</span> badge to remove them.
      </span>
    </span>
    <Button
      class="pointer-events-auto"
      size="sm"
      variant="secondary"
      @click="chrome.exitEditMode()"
    >
      <X class="size-3.5" />
      Exit edit mode
    </Button>
  </div>
</template>
