<script setup lang="ts">
import { X } from "@lucide/vue";

import Button from "@/components/ui/Button.vue";
import { useChromeStore } from "@/stores/chrome";

const chrome = useChromeStore();
</script>

<template>
  <!--
    Rendered inline at the top of the shell (above ChromeBar) so the banner
    occupies its own layout row and never overlays the chrome below. AppShell
    uses `flex-col`, so this div becomes the first flex child when active.
    No absolute positioning, no pointer-events-none — keep it a normal row so
    the chrome bar underneath is fully interactive.
  -->
  <div
    v-if="chrome.editMode"
    class="border-accent-500 bg-accent-500 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1 text-xs text-white"
  >
    <span class="flex items-center gap-2">
      <span class="font-medium">Chrome edit mode</span>
      <span class="opacity-80">
        Drag items to reorder, click <span class="font-mono">+</span> to add, the
        <span class="font-mono">×</span> badge to remove.
      </span>
    </span>
    <Button size="sm" variant="secondary" @click="chrome.exitEditMode()">
      <X class="size-3.5" />
      Exit edit mode
    </Button>
  </div>
</template>
