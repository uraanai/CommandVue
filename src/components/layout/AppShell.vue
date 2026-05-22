<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterView } from "vue-router";

import SaveLayoutAsDialog from "@/components/dialogs/SaveLayoutAsDialog.vue";
import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";
import { useTheme } from "@/composables/useTheme";
import { newId } from "@/modules/storage/ids";
import { useLayoutStore } from "@/stores/layout";
import { usePanelStateStore } from "@/stores/panelState";
import { useSessionStore } from "@/stores/session";
import { useToolsStore } from "@/stores/tools";
import { useUiStore } from "@/stores/ui";

import CommandPalette from "./CommandPalette.vue";
import MenuBar from "./MenuBar.vue";
import StatusBar from "./StatusBar.vue";
import TitleBar from "./TitleBar.vue";
import WorkspaceSwitcher from "./WorkspaceSwitcher.vue";

// Bootstrap the theme composable so `data-theme` lands on <html> from first paint.
useTheme();

const tools = useToolsStore();
const ui = useUiStore();
const session = useSessionStore();
const layoutStore = useLayoutStore();
const panelStateStore = usePanelStateStore();

const saveAsOpen = ref(false);

const currentLayoutLabel = computed(() => {
  const name = layoutStore.currentLayout?.name ?? "—";
  return session.dirty ? `${name} •` : name;
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
  // Find an existing components-browser panel via its panel-state record
  // (Dockview's IDockviewPanel doesn't expose the component-id field).
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
  <div class="bg-surface text-foreground flex h-screen w-screen flex-col overflow-hidden">
    <TitleBar />
    <div
      class="border-border bg-surface-raised flex items-center justify-between border-b px-1 py-0"
    >
      <MenuBar />
      <div class="flex items-center gap-3 px-2">
        <span class="text-faint text-xs">
          Layout: <span class="text-foreground font-medium">{{ currentLayoutLabel }}</span>
        </span>
        <WorkspaceSwitcher />
      </div>
    </div>
    <main class="min-h-0 flex-1">
      <RouterView />
    </main>
    <StatusBar />
    <CommandPalette />
    <SaveLayoutAsDialog
      v-model:visible="saveAsOpen"
      :default-name="(layoutStore.currentLayout?.name ?? '') + ' (saved)'"
      @save="onSaveAs"
    />
  </div>
</template>
