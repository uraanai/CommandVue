<script setup lang="ts">
import type { DockviewApi } from "dockview-vue";

import { onUnmounted, ref, watch } from "vue";

import DockMenu from "./DockMenu.vue";
import { useDockMenuModel, type DockMenuItem } from "./useDockMenuModel";

/**
 * Right-click context menu for BOTH dock pane types, in the MAIN window.
 *
 * CUSTOM by necessity: dockview exposes no slot to inject per-group chrome on
 * a header-hidden group, and the maintainer wants ZERO persistent chrome over
 * the map. So instead of an always-mounted overlay we attach a single
 * `contextmenu` listener to the dock root (supplied via the `root` PROP -
 * `DockviewApi` itself has no `.element`) and open the shared `DockMenu` at the
 * cursor with a model that depends on the right-clicked group's mode.
 *
 * The model itself (clean vs tabbed, the Float / Pop out / Maximize / Minimize /
 * Close items, the always-first header toggle + always-last Close anchors) lives
 * in `useDockMenuModel` so the per-pop-out-window menu (`DockPopoutContextMenu`,
 * Track B Phase 6c) renders from the SAME definition. The model is rebuilt on
 * every right-click, so live labels (Maximize/Restore from `isMaximized()`) are
 * always fresh and no `onDidMaximizedGroupChange` subscription is needed.
 *
 * Stage-1 Playwright-verified per the CommandVue verification protocol - no unit
 * test (the pure label/disabled logic in `*PaneControls.ts` is unit-tested).
 */
const props = defineProps<{ api: DockviewApi | null; root: HTMLElement | null }>();

const { buildModelForGroup } = useDockMenuModel();

const menuRef = ref<InstanceType<typeof DockMenu> | null>(null);
const model = ref<DockMenuItem[]>([]);
const disposers: Array<() => void> = [];

function onContextMenu(event: MouseEvent): void {
  const api = props.api;
  if (!api) return;
  const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(".dv-groupview");
  const group = api.groups.find((g) => g.element === el || g.element.contains(el as Node));
  // Over a gutter or no group at all: do nothing, let the event bubble.
  if (!group) return;

  const next = buildModelForGroup(group, api.panels.length);
  if (next.length === 0) return;

  event.preventDefault();
  event.stopPropagation();
  model.value = next;
  menuRef.value?.show(event);
}

watch(
  () => props.root,
  (root) => {
    for (const d of disposers.splice(0)) d();
    if (!root) return;
    root.addEventListener("contextmenu", onContextMenu);
    disposers.push(() => root.removeEventListener("contextmenu", onContextMenu));
  },
  { immediate: true },
);

onUnmounted(() => {
  for (const d of disposers.splice(0)) d();
});
</script>

<template>
  <DockMenu ref="menuRef" :model="model" />
</template>
