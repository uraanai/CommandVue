<script setup lang="ts">
import type { MinimizedEntry } from "@/stores/minimized";

import { PanelTop, X } from "@lucide/vue";
import { computed } from "vue";

import Button from "@/components/ui/Button.vue";
import IconButton from "@/components/ui/IconButton.vue";

/**
 * One minimized-window bar in the tray (Track B Phase 4c). The title region
 * restores the group; the trailing × discards it. A generic panel glyph is used
 * rather than the per-panel icon — the app has no Lucide-name → component
 * resolver, and importing the full icon pack is forbidden (CLAUDE.md). The `+N`
 * badge shows extra tabs when the minimized group held more than one panel.
 */
const props = defineProps<{ entry: MinimizedEntry }>();
const emit = defineEmits<{ restore: []; discard: [] }>();

const extraCount = computed(() => props.entry.panels.length - 1);
// Explicit accessible name: the visible text is just the title (+N), which a
// screen reader would announce without conveying the restore action.
const restoreLabel = computed(
  () =>
    `Restore ${props.entry.title}${extraCount.value > 0 ? ` and ${extraCount.value} more` : ""}`,
);
</script>

<template>
  <div
    class="border-border bg-surface-raised pointer-events-auto flex items-center overflow-hidden rounded-md border shadow-md"
  >
    <Button
      variant="ghost"
      size="sm"
      class="rounded-none"
      :title="restoreLabel"
      :aria-label="restoreLabel"
      @click="emit('restore')"
    >
      <PanelTop class="text-muted size-3.5 shrink-0" />
      <span class="max-w-[12rem] truncate">{{ entry.title }}</span>
      <span v-if="extraCount > 0" class="text-muted ml-1 text-[10px] tabular-nums"
        >+{{ extraCount }}</span
      >
    </Button>
    <IconButton
      label="Discard minimized window"
      size="sm"
      class="rounded-none"
      @click="emit('discard')"
    >
      <X />
    </IconButton>
  </div>
</template>
