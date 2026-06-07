<script setup lang="ts">
import type { MinimizedEntry } from "@/stores/minimized";

import { Maximize2, PanelTop, X } from "@lucide/vue";
import { computed } from "vue";

import Button from "@/components/ui/Button.vue";
import IconButton from "@/components/ui/IconButton.vue";

/**
 * One minimized-window bar in the tray (Track B Phase 4c). Two restore
 * affordances — the title region AND a trailing maximize (⤢) button — RESTORE
 * the group/tab to where it was; the final × CLOSES it (drops the bar; its
 * panels were already removed at minimize). A generic panel glyph is used rather
 * than the per-panel icon — the app has no Lucide-name → component resolver, and
 * importing the full icon pack is forbidden (CLAUDE.md). The `+N` badge shows
 * extra tabs when the minimized group held more than one panel.
 */
const props = defineProps<{ entry: MinimizedEntry }>();
const emit = defineEmits<{ restore: []; discard: [] }>();

const extraCount = computed(() => props.entry.panels.length - 1);
// Explicit accessible names: the visible text is just the title (+N), which a
// screen reader would announce without conveying the restore / close action.
const restoreLabel = computed(
  () =>
    `Restore ${props.entry.title}${extraCount.value > 0 ? ` and ${extraCount.value} more` : ""}`,
);
const closeLabel = computed(() => `Close ${props.entry.title}`);
</script>

<template>
  <!-- Inset RING (not a border) for the outline: a real border adds 2px to the
       layout height, making the bar taller than the chevron handle in the tray; an
       inset ring draws inside the box with zero layout impact, so the bar's height
       matches the handle's (both driven by the same inner control height). -->
  <div
    class="bg-surface-raised pointer-events-auto flex items-center overflow-hidden rounded-md shadow-md ring-1 ring-[color:var(--color-border)] ring-inset"
  >
    <Button
      variant="ghost"
      size="sm"
      class="h-[var(--density-control-height)] rounded-none text-[length:var(--density-font-size)]"
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
      :label="restoreLabel"
      size="sm"
      class="h-[var(--density-control-height)] rounded-none"
      @click="emit('restore')"
    >
      <Maximize2 />
    </IconButton>
    <IconButton
      :label="closeLabel"
      size="sm"
      class="h-[var(--density-control-height)] rounded-none"
      @click="emit('discard')"
    >
      <X />
    </IconButton>
  </div>
</template>
