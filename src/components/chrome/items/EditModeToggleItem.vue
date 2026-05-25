<script setup lang="ts">
import { Pencil, X } from "@lucide/vue";

import Button from "@/components/ui/Button.vue";
import { useChromeStore } from "@/stores/chrome";

const chrome = useChromeStore();
</script>

<template>
  <Button
    v-if="chrome.canEdit"
    variant="ghost"
    size="sm"
    :title="chrome.editMode ? 'Exit chrome edit mode' : 'Edit chrome layout'"
    @click="chrome.toggleEditMode()"
  >
    <X v-if="chrome.editMode" class="size-3" />
    <Pencil v-else class="size-3" />
    <span>{{ chrome.editMode ? "Done" : "Edit" }}</span>
  </Button>
</template>
