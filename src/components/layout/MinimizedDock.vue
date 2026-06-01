<script setup lang="ts">
import { storeToRefs } from "pinia";

import { useMinimizedStore } from "@/stores/minimized";

import MinimizedBar from "./MinimizedBar.vue";

/**
 * Bottom-left minimized-window tray (Track B Phase 4c, master-spec D6). A
 * standalone overlay mounted in `AppShell`'s dock area (NOT a chrome item — the
 * status bar stays the app's, uncluttered). The container is `pointer-events-none`
 * so its empty space never intercepts dock clicks/drags; each bar re-enables
 * pointer events. Renders nothing when the tray is empty (zero layout cost).
 * `z-30`: above the dock + floating windows, below modals (`z-50`) / Select
 * popups (`z-[100]`). The list is ephemeral — `session.loadLayout` clears it.
 */
const minimized = useMinimizedStore();
const { entries } = storeToRefs(minimized);
</script>

<template>
  <div
    v-if="entries.length > 0"
    class="pointer-events-none absolute bottom-0 left-0 z-30 flex max-w-full flex-wrap items-end gap-2 p-2"
  >
    <MinimizedBar
      v-for="entry in entries"
      :key="entry.id"
      :entry="entry"
      @restore="minimized.restore(entry.id)"
      @discard="minimized.discard(entry.id)"
    />
  </div>
</template>
