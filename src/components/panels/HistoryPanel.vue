<script setup lang="ts">
import type { HistoryEntry, HistoryScope } from "@/modules/history/types";

import {
  History,
  Layers,
  LayoutPanelLeft,
  LayoutTemplate,
  List,
  Paintbrush,
  Palette,
  PanelsTopLeft,
  PenTool,
  SlidersHorizontal,
} from "@lucide/vue";
import { computed, type Component } from "vue";

import { useHistoryStore } from "@/stores/history";

/**
 * History panel — a live view of the per-workspace undo/redo stack.
 *
 * Undo entries are listed newest-first just below the cursor; redo entries sit
 * above it, greyed. Clicking any row "jumps" there by undoing/redoing the
 * appropriate number of steps. The list is reactive to the history store, so it
 * tracks Ctrl+Z / Ctrl+Y and every `history.execute(...)`.
 */
const history = useHistoryStore();

const SCOPE_ICON: Record<HistoryScope, Component> = {
  drawings: PenTool,
  entities: List,
  "panel-state": SlidersHorizontal,
  "dockview-layout": LayoutPanelLeft,
  workspace: Layers,
  layout: LayoutTemplate,
  preset: Palette,
  chrome: PanelsTopLeft,
  theme: Paintbrush,
};

function labelOf(entry: HistoryEntry): string {
  return entry.kind === "command" ? entry.command.label : entry.transaction.label;
}
function scopeOf(entry: HistoryEntry): HistoryScope {
  return entry.kind === "command" ? entry.command.scope : entry.transaction.scope;
}
function iconFor(entry: HistoryEntry): Component {
  return SCOPE_ICON[scopeOf(entry)] ?? History;
}

// Newest undo entry first (just below the cursor); redo entries kept in stack
// order so the next-to-redo sits closest to the cursor.
const undoRows = computed(() => [...history.undoEntries].reverse());
const redoRows = computed(() => history.redoEntries);

async function jumpUndo(displayIndex: number): Promise<void> {
  // Undo the newest entry down to and including the clicked one.
  for (let i = 0; i <= displayIndex; i++) await history.undo();
}
async function jumpRedo(displayIndex: number): Promise<void> {
  // Redo from the next-to-redo up to and including the clicked one.
  const count = redoRows.value.length - displayIndex;
  for (let i = 0; i < count; i++) await history.redo();
}
</script>

<template>
  <div class="bg-surface text-foreground flex h-full flex-col text-sm">
    <div class="border-border flex items-center justify-between border-b px-3 py-2">
      <span class="text-faint text-[10px] font-medium tracking-[0.18em] uppercase">History</span>
      <span class="text-muted text-[11px]">{{ history.undoEntries.length }} undoable</span>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto py-1">
      <p
        v-if="undoRows.length === 0 && redoRows.length === 0"
        class="text-muted px-3 py-8 text-center text-xs"
      >
        No history yet. Actions you take appear here — undo with Ctrl+Z.
      </p>

      <!-- Redo entries (above the cursor, greyed) -->
      <div
        v-for="(entry, i) in redoRows"
        :key="`redo-${i}`"
        role="button"
        tabindex="0"
        class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left opacity-45 hover:bg-white/5 hover:opacity-80"
        @click="jumpRedo(i)"
        @keydown.enter="jumpRedo(i)"
        @keydown.space.prevent="jumpRedo(i)"
      >
        <component :is="iconFor(entry)" class="text-muted size-3.5 shrink-0" />
        <span class="truncate">{{ labelOf(entry) }}</span>
      </div>

      <div
        v-if="redoRows.length > 0 && undoRows.length > 0"
        class="border-border mx-3 my-1 border-b"
      />

      <!-- Undo entries (newest first, below the cursor) -->
      <div
        v-for="(entry, i) in undoRows"
        :key="`undo-${i}`"
        role="button"
        tabindex="0"
        class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left hover:bg-white/5"
        :class="i === 0 ? 'text-foreground' : 'text-muted'"
        @click="jumpUndo(i)"
        @keydown.enter="jumpUndo(i)"
        @keydown.space.prevent="jumpUndo(i)"
      >
        <component :is="iconFor(entry)" class="size-3.5 shrink-0" />
        <span class="truncate">{{ labelOf(entry) }}</span>
      </div>
    </div>
  </div>
</template>
