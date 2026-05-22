<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterView } from "vue-router";

import ChromeBar from "@/components/chrome/ChromeBar.vue";
import EditModeOverlay from "@/components/chrome/EditModeOverlay.vue";
import SaveLayoutAsDialog from "@/components/dialogs/SaveLayoutAsDialog.vue";
import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";
import { useTheme } from "@/composables/useTheme";
import { newId } from "@/modules/storage/ids";
import { useChromeStore } from "@/stores/chrome";
import { useLayoutStore } from "@/stores/layout";
import { usePanelStateStore } from "@/stores/panelState";
import { useSessionStore } from "@/stores/session";
import { useToolsStore } from "@/stores/tools";
import { useUiStore } from "@/stores/ui";

import CommandPalette from "./CommandPalette.vue";

// Bootstrap the theme composable so `data-theme` lands on <html> from first paint.
useTheme();

const tools = useToolsStore();
const ui = useUiStore();
const session = useSessionStore();
const layoutStore = useLayoutStore();
const panelStateStore = usePanelStateStore();
const chrome = useChromeStore();

const saveAsOpen = ref(false);

onMounted(async () => {
  // Workspace + layout were loaded in App.vue.onMounted; chrome lives on its
  // own loader because the chrome bars render outside the workspace-ready
  // gate so the user always has the app icon and menu bar available.
  await chrome.loadProfiles();
});

async function onSaveAs(payload: {
  name: string;
  description?: string;
  setAsWorkspaceDefault: boolean;
}): Promise<void> {
  await session.saveCurrentAsNewLayout(payload);
}

function toggleComponentsPanel(): void {
  const api = session.getDockviewApi();
  if (!api) return;
  const states = panelStateStore.listForLayout();
  const browserState = states.find((s) => s.panelType === "components-browser");
  if (browserState) {
    const existing = api.getPanel(browserState.id);
    if (existing) {
      existing.api.close();
      return;
    }
  }
  const layoutId = layoutStore.currentLayoutId;
  if (!layoutId) return;
  const panelId = newId();
  void panelStateStore.createPanel({
    layoutId,
    panelType: "components-browser",
    assignmentState: "configured",
    id: panelId,
  });
  api.addPanel({
    id: panelId,
    component: "components-browser",
    title: "Components",
    floating: true,
  });
  session.markDirty();
}

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
    if (action === "layout.save") {
      if (session.dirty && session.loadedLayoutId) void session.updateCurrentLayout();
      return;
    }
    if (action === "layout.saveAs") {
      saveAsOpen.value = true;
      return;
    }
    if (action === "view.toggleComponents") {
      toggleComponentsPanel();
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
  <div class="bg-surface text-foreground relative flex h-screen w-screen flex-col overflow-hidden">
    <EditModeOverlay />
    <ChromeBar position="top" />
    <main class="min-h-0 flex-1">
      <RouterView />
    </main>
    <ChromeBar v-if="chrome.statusBarVisible" position="status" />
    <CommandPalette />
    <SaveLayoutAsDialog
      v-model:visible="saveAsOpen"
      :default-name="(layoutStore.currentLayout?.name ?? '') + ' (saved)'"
      @save="onSaveAs"
    />
  </div>
</template>
