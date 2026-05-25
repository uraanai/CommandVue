<script setup lang="ts">
import "dockview-vue/dist/styles/dockview.css";

import "@/assets/styles/dockview.css";

import {
  DockviewVue,
  type DockviewApi,
  type DockviewReadyEvent,
  type DockviewTheme,
} from "dockview-vue";
import { onUnmounted, provide } from "vue";

import { useLayoutStore } from "@/stores/layout";
import { useSessionStore } from "@/stores/session";

import { resetLayoutKey } from "./keys";

// Panel components are registered globally in `main.ts` via `app.component()`
// because dockview-vue 6 dropped the v4 `:components` prop and instead resolves
// each panel's `component` string by walking Vue's component registry.

const session = useSessionStore();
const layoutStore = useLayoutStore();

async function onReady(event: DockviewReadyEvent) {
  session.bindDockview(event.api);

  const target = layoutStore.currentLayoutId;
  if (target) {
    await session.loadLayout(target);
  }

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
  <DockviewVue :theme="commandvueTheme" class="h-full w-full" @ready="onReady" />
</template>
