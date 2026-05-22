<script setup lang="ts">
import { Pencil, X } from "@lucide/vue";

import { useChromeStore } from "@/stores/chrome";

const chrome = useChromeStore();
</script>

<template>
  <button
    v-if="chrome.canEdit"
    type="button"
    class="text-muted hover:text-foreground hover:bg-surface-sunken flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
    :title="chrome.editMode ? 'Exit chrome edit mode' : 'Edit chrome layout'"
    @click="chrome.toggleEditMode()"
  >
    <X v-if="chrome.editMode" class="size-3" />
    <Pencil v-else class="size-3" />
    <span>{{ chrome.editMode ? "Done" : "Edit" }}</span>
  </button>
</template>
