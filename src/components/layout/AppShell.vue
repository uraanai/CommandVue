<script setup lang="ts">
import { RouterView } from "vue-router";

import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";
import { useTheme } from "@/composables/useTheme";
import { useToolsStore } from "@/stores/tools";
import { useUiStore } from "@/stores/ui";

import CommandPalette from "./CommandPalette.vue";
import StatusBar from "./StatusBar.vue";
import TitleBar from "./TitleBar.vue";

// Bootstrap the theme composable so `data-theme` lands on <html> from first paint.
useTheme();

const tools = useToolsStore();
const ui = useUiStore();

// Bridge the declarative shortcut catalog to the relevant stores. All
// other components just call store actions; only this bridge knows about
// the catalog's action ids.
useKeyboardShortcuts({
  onAction(action) {
    if (action === "palette.open") {
      ui.openCommandPalette();
      return;
    }
    if (action === "tool.deactivate") {
      tools.deactivate();
      return;
    }
    if (action.startsWith("tool.")) {
      const toolId = action.slice("tool.".length);
      tools.toggle(toolId);
    }
  },
});
</script>

<template>
  <div class="bg-surface text-foreground flex h-screen w-screen flex-col overflow-hidden">
    <TitleBar />
    <main class="min-h-0 flex-1">
      <RouterView />
    </main>
    <StatusBar />
    <CommandPalette />
  </div>
</template>
