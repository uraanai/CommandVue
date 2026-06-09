<script setup lang="ts">
import { Redo2, Undo2 } from "@lucide/vue";
import { computed } from "vue";

import IconButton from "@/components/ui/IconButton.vue";
import { useHistoryStore } from "@/stores/history";

// Two density-aware icon buttons sharing one chrome item. They disable when
// there is nothing to undo/redo and surface the next action's label as the
// tooltip + aria-label ("Undo Add drawing"). When the menu bar is hidden these
// are the only pointer affordance for undo/redo; keyboard always works.
const history = useHistoryStore();

const undoTitle = computed(() =>
  history.canUndo ? `Undo ${history.undoLabel ?? ""}`.trimEnd() : "Nothing to undo",
);
const redoTitle = computed(() =>
  history.canRedo ? `Redo ${history.redoLabel ?? ""}`.trimEnd() : "Nothing to redo",
);
</script>

<template>
  <div class="flex items-center gap-0.5">
    <IconButton
      :label="undoTitle"
      :title="undoTitle"
      :disabled="!history.canUndo"
      variant="ghost"
      size="sm"
      data-testid="undo-button"
      @click="history.undo()"
    >
      <Undo2 class="size-3.5" />
    </IconButton>
    <IconButton
      :label="redoTitle"
      :title="redoTitle"
      :disabled="!history.canRedo"
      variant="ghost"
      size="sm"
      data-testid="redo-button"
      @click="history.redo()"
    >
      <Redo2 class="size-3.5" />
    </IconButton>
  </div>
</template>
