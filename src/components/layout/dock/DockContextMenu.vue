<script setup lang="ts">
import type { DockviewApi } from "dockview-vue";
import type { MenuItem } from "primevue/menuitem";

import { ChevronRight, PanelTop, SquareSplitHorizontal, X } from "@lucide/vue";
import { onUnmounted, ref, watch, type Component } from "vue";

import ContextMenu from "@/components/ui/ContextMenu.vue";
import { MISSING_PANEL_TYPE } from "@/modules/panels/missing";
import { panelRegistry } from "@/modules/panels/registry";
import { UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
import { useSessionStore } from "@/stores/session";

import { cleanPaneControls } from "./cleanPaneControls";

/**
 * Right-click context menu for clean (header-less) dock panes.
 *
 * CUSTOM by necessity: dockview exposes no slot to inject per-group chrome on
 * a header-hidden group, and the maintainer wants ZERO persistent chrome over
 * the map. So instead of an always-mounted overlay we attach a single
 * `contextmenu` listener to the dock root (supplied via the `root` PROP —
 * `DockviewApi` itself has no `.element`) and only open a PrimeVue
 * `ContextMenu` at the cursor when the right-click lands on a clean pane.
 * Nothing renders otherwise.
 *
 * The pure label/disabled decision logic (Show-header label, Close
 * empty-workspace guard) lives in `cleanPaneControls.ts` (unit-tested); the
 * Split submenu is built from `panelRegistry.list()`. This component is Stage-1
 * Playwright-verified per the CommandVue verification protocol — no unit test.
 */
const props = defineProps<{ api: DockviewApi | null; root: HTMLElement | null }>();
const session = useSessionStore();

/** Menu item shape with the Lucide component attached for the `#item` slot. */
type CleanMenuItem = MenuItem & { lucide?: Component };

const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null);
const model = ref<CleanMenuItem[]>([]);
const disposers: Array<() => void> = [];

/**
 * Registered panel types eligible as a split target — the synthetic
 * `__unassigned__` and `__missing__` placeholder types and the
 * components-browser shell are filtered out (splitting into any of them would
 * be nonsensical), mirroring MenuBar's Add-Component picker.
 */
function panelChoices() {
  return panelRegistry
    .list()
    .filter(
      (d) =>
        d.id !== UNASSIGNED_PANEL_TYPE &&
        d.id !== MISSING_PANEL_TYPE &&
        d.id !== "components-browser",
    );
}

/**
 * Build the menu model fresh on each right-click so the active panel id and
 * total-panel count are captured at open time. `panelId` is the clean group's
 * active panel; `totalPanels` drives the Close empty-workspace guard. The
 * group is always clean here (the listener returns early otherwise), so the
 * Show-header label is derived with `isHeaderless: true`.
 */
function buildModel(panelId: string, totalPanels: number): CleanMenuItem[] {
  const controls = cleanPaneControls({ isHeaderless: true, totalPanels });
  const showHeader = controls.find((c) => c.id === "toggle-header");
  const close = controls.find((c) => c.id === "close");

  return [
    {
      label: showHeader?.label ?? "Show header",
      lucide: PanelTop,
      command: () => void session.toggleHeaderless(panelId),
    },
    {
      label: "Split",
      lucide: SquareSplitHorizontal,
      items: panelChoices().map((def) => ({
        label: def.title,
        command: () => void session.splitCleanNeighbor(panelId, def.id),
      })),
    },
    { separator: true },
    {
      label: "Close",
      lucide: X,
      disabled: close?.disabled ?? false,
      command: () => void session.removePanelGuarded(panelId),
    },
  ];
}

function onContextMenu(event: MouseEvent): void {
  const api = props.api;
  if (!api) return;
  const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(".dv-groupview");
  const group = api.groups.find((g) => g.element === el || g.element.contains(el as Node));
  // Only clean (header-hidden) groups get the menu. Over a tabbed group, a
  // gutter, or no group at all: do nothing and let the event bubble (tabbed
  // panes get their own controls in a later phase).
  if (!group || !group.header.hidden) return;

  const panel = group.activePanel ?? group.panels[0];
  if (!panel) return;

  event.preventDefault();
  event.stopPropagation();
  model.value = buildModel(panel.id, api.panels.length);
  contextMenuRef.value?.show(event);
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
  <ContextMenu ref="contextMenuRef" :model="model" data-testid="clean-pane-context-menu">
    <template #item="{ item, props: itemProps, hasSubmenu }">
      <a
        v-bind="itemProps.action"
        :class="[
          'flex w-full items-center gap-2 text-[length:var(--density-font-size)]',
          (item as CleanMenuItem).disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        ]"
      >
        <component
          :is="(item as CleanMenuItem).lucide"
          v-if="(item as CleanMenuItem).lucide"
          class="text-muted size-3.5"
        />
        <span class="flex-1">{{ item.label }}</span>
        <ChevronRight v-if="hasSubmenu" class="text-faint size-3.5" />
      </a>
    </template>
  </ContextMenu>
</template>
