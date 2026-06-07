<script setup lang="ts">
import "dockview-vue/dist/styles/dockview.css";

import "@/assets/styles/dockview.css";

import {
  DockviewVue,
  type DockviewApi,
  type DockviewReadyEvent,
  type DockviewTheme,
} from "dockview-vue";
import { onUnmounted, provide, ref, shallowRef } from "vue";

import { usePopoutWindows } from "@/composables/usePopoutWindows";
import { presetTypeRegistry } from "@/modules/presets/registry";
import { useLayoutStore } from "@/stores/layout";
import { usePanelStateStore } from "@/stores/panelState";
import { usePresetStore } from "@/stores/preset";
import { useSessionStore } from "@/stores/session";

import DockContextMenu from "./dock/DockContextMenu.vue";
import DockPopoutContextMenu from "./dock/DockPopoutContextMenu.vue";
import { resetLayoutKey } from "./keys";

// Dock-root element for the clean-pane context menu (DockviewApi has no
// `.element`), plus a reactive handle on the bound API so the menu re-binds
// its `contextmenu` listener once dockview is ready.
const rootEl = ref<HTMLElement | null>(null);
const boundApi = shallowRef<DockviewApi | null>(null);

// Open pop-out windows — each gets its own context-menu host so right-clicking
// inside a pop-out shows our menu, not the browser's native one (Phase 6c).
const popoutWindows = usePopoutWindows();

// Panel components are registered globally in `main.ts` via `app.component()`
// because dockview-vue 6 dropped the v4 `:components` prop and instead resolves
// each panel's `component` string by walking Vue's component registry.

const session = useSessionStore();
const layoutStore = useLayoutStore();
const panelStateStore = usePanelStateStore();
const presetStore = usePresetStore();

/**
 * On-load apply path for `panel-appearance` presets (Track A C4) — the PRIMARY
 * mechanism, not a fallback. Most built-in panels don't run a per-panel
 * `watch(appliedPresetIds)` re-apply, so after a layout loads we sweep every
 * panel-state, find its applied `panel-appearance` preset(s), and re-set the
 * `data-cv-appearance` attribute on the dock group. Deferred to a frame so
 * dockview has laid out its groups; one retry covers a late group layout.
 */
function sweepPanelAppearance(attempt = 0): void {
  const def = presetTypeRegistry.get("panel-appearance");
  if (!def) return;
  const api = session.getDockviewApi();
  if (!api) return;
  let allResolved = true;
  for (const ps of panelStateStore.listForLayout()) {
    for (const presetId of ps.appliedPresetIds ?? []) {
      const preset = presetStore.getPreset(presetId);
      if (preset?.presetTypeId !== "panel-appearance") continue;
      if (!api.getPanel(ps.id)?.api.group.element) {
        allResolved = false;
        continue;
      }
      void def.applyToPanel(ps.id, preset.config);
    }
  }
  // dockview may not have laid out every group on the first frame — retry once.
  if (!allResolved && attempt < 1) {
    requestAnimationFrame(() => sweepPanelAppearance(attempt + 1));
  }
}

async function onReady(event: DockviewReadyEvent) {
  session.bindDockview(event.api);
  boundApi.value = event.api;

  const target = layoutStore.currentLayoutId;
  if (target) {
    await session.loadLayout(target);
  }

  // Re-apply persisted panel-appearance variants once groups have rendered.
  requestAnimationFrame(() => sweepPanelAppearance());

  // Every Dockview-side change (drag, split, resize, rename, close) marks
  // the session dirty. The user resolves dirty state via Save Layout
  // (Cmd/Ctrl+S in Phase D) or Discard. Auto-save is intentionally NOT
  // wired here — Phase G layers per-panel debounced state writes; the
  // dock shape itself is user-saved.
  event.api.onDidLayoutChange(() => session.markDirty());
}

function discardChanges(): void {
  void session.discardChanges();
}

provide(resetLayoutKey, discardChanges);

/**
 * Project-owned Dockview theme. The `className` matches the rule block in
 * `src/assets/styles/dockview.css` where the `--dv-*` variables are bound to
 * CommandVue's semantic tokens (so light + dark themes flow through the same
 * class). Passing this as a prop tells dockview-vue to apply our class to its
 * inner `.dv-shell` element instead of the default `dockview-theme-abyss`,
 * which previously won the cascade and forced the dark-tab look in both
 * light and dark modes.
 */
const commandvueTheme: DockviewTheme = {
  name: "commandvue",
  className: "dockview-theme-commandvue",
};

onUnmounted(() => {
  session.unbindDockview();
});

function maybePromptUnload(api: DockviewApi | null): void {
  // Reserved for Phase D — the UnsavedChangesDialog flow attaches here.
  if (!api) return;
}
maybePromptUnload(session.getDockviewApi());
</script>

<template>
  <div ref="rootEl" class="relative h-full w-full">
    <!--
      `floating-group-bounds="boundedWithinViewport"` clamps in-window floating
      panels (Track B Phase 3) so they can't be dragged off-screen.

      We deliberately do NOT set `default-renderer="always"`: Stage-1 runtime
      testing confirmed a floated Cesium AND MapLibre panel keep their WebGL
      context across the float + dock-back DOM move with dockview's DEFAULT
      renderer. `always` would keep every hidden (inactive-tab) map panel
      rendering for no benefit here — needless GPU/memory cost on a map-first app.
    -->
    <DockviewVue
      :theme="commandvueTheme"
      no-panels-overlay="emptyGroup"
      floating-group-bounds="boundedWithinViewport"
      right-header-actions-component="commandvue-header-actions"
      class="h-full w-full"
      @ready="onReady"
    />
    <DockContextMenu :api="boundApi" :root="rootEl" />
    <template v-if="boundApi">
      <DockPopoutContextMenu
        v-for="entry in popoutWindows"
        :key="entry.id"
        :api="boundApi"
        :win="entry.win"
      />
    </template>
  </div>
</template>
