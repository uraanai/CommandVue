<script setup lang="ts">
import type { DockviewApi, IDockviewPanel } from "dockview-vue";
import type { MenuItem } from "primevue/menuitem";

import {
  ChevronRight,
  Columns2,
  Maximize2,
  Minimize2,
  PanelTop,
  PanelTopClose,
  SquareSplitHorizontal,
  X,
} from "@lucide/vue";
import { onUnmounted, ref, watch, type Component } from "vue";

import ContextMenu from "@/components/ui/ContextMenu.vue";
import { MISSING_PANEL_TYPE } from "@/modules/panels/missing";
import { panelRegistry } from "@/modules/panels/registry";
import { UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
import { useSessionStore } from "@/stores/session";

import { cleanPaneControls } from "./cleanPaneControls";
import { tabbedPaneControls } from "./tabbedPaneControls";

/**
 * Right-click context menu for BOTH dock pane types.
 *
 * CUSTOM by necessity: dockview exposes no slot to inject per-group chrome on
 * a header-hidden group, and the maintainer wants ZERO persistent chrome over
 * the map. So instead of an always-mounted overlay we attach a single
 * `contextmenu` listener to the dock root (supplied via the `root` PROP -
 * `DockviewApi` itself has no `.element`) and open a PrimeVue `ContextMenu`
 * at the cursor with a model that depends on the right-clicked group's mode:
 *
 * Both menus share ONE skeleton for cross-state consistency -
 * [header toggle, secondary action, Maximize, separator, Close] - so the header
 * toggle, Maximize, and Close never change position between right-clicks; only
 * the single state-specific "secondary" item differs:
 *
 *  - CLEAN group (`header.hidden === true`): Show header / Split / Maximize /
 *    -- / Close - the Phase-1 clean-pane menu, now with Maximize.
 *  - TABBED group (`header.hidden === false`): Hide header / Close others /
 *    Maximize / -- / Close. "Hide header" routes through the same
 *    `session.toggleHeaderless`, completing the clean<->tabbed round-trip.
 *
 * The Maximize/Restore label is always read fresh from `panel.api.isMaximized()`
 * at menu-open time, and the model is rebuilt on every right-click - so we do
 * NOT subscribe to `api.onDidMaximizedGroupChange`. There is no persistent
 * always-mounted control whose label could go stale; a subscription would be
 * dead weight. (The event is still modeled as a no-op in the test fake.)
 *
 * Pure label/disabled logic lives in `cleanPaneControls.ts` /
 * `tabbedPaneControls.ts` (unit-tested); iteration + maximize logic lives in
 * unit-tested session actions (`closeOthersInGroup`, `toggleMaximize`). This
 * component is Stage-1 Playwright-verified per the CommandVue verification
 * protocol - no unit test.
 */
const props = defineProps<{ api: DockviewApi | null; root: HTMLElement | null }>();
const session = useSessionStore();

/** Menu item shape with the Lucide component attached for the `#item` slot. */
type DockMenuItem = MenuItem & { lucide?: Component };

const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null);
const model = ref<DockMenuItem[]>([]);
const disposers: Array<() => void> = [];

/**
 * Registered panel types eligible as a split target - the synthetic
 * `__unassigned__` and `__missing__` placeholder types and the
 * components-browser shell are filtered out, mirroring MenuBar's
 * Add-Component picker.
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
 * Maximize/Restore item shared by both menus. Label + icon flip on live state;
 * disabled off-grid so the affordance matches `session.toggleMaximize`'s
 * grid-only gate (floating / pop-out / edge groups have no maximize concept -
 * none ship in Phase 2, but the gate is coded now).
 */
function maximizeItem(panel: IDockviewPanel): DockMenuItem {
  const maximized = panel.api.isMaximized();
  const onGrid = panel.api.location.type === "grid";
  return {
    label: maximized ? "Restore" : "Maximize",
    lucide: maximized ? Minimize2 : Maximize2,
    disabled: !onGrid,
    command: () => void session.toggleMaximize(panel.id),
  };
}

/**
 * CLEAN pane menu (group.header.hidden === true). Phase-1 items + Maximize, in
 * the shared skeleton [header toggle, secondary action, Maximize, --, Close]
 * that buildTabbedModel also follows. `totalPanels` drives the Close
 * empty-workspace guard; the group is always clean here, so Show-header is
 * derived with `isHeaderless: true`.
 */
function buildCleanModel(panel: IDockviewPanel, totalPanels: number): DockMenuItem[] {
  const controls = cleanPaneControls({ isHeaderless: true, totalPanels });
  const showHeader = controls.find((c) => c.id === "toggle-header");
  const close = controls.find((c) => c.id === "close");

  return [
    {
      label: showHeader?.label ?? "Show header",
      lucide: PanelTop,
      command: () => void session.toggleHeaderless(panel.id),
    },
    {
      label: "Split",
      lucide: SquareSplitHorizontal,
      items: panelChoices().map((def) => ({
        label: def.title,
        command: () => void session.splitCleanNeighbor(panel.id, def.id),
      })),
    },
    maximizeItem(panel),
    { separator: true },
    {
      label: "Close",
      lucide: X,
      disabled: close?.disabled ?? false,
      command: () => void session.removePanelGuarded(panel.id),
    },
  ];
}

/**
 * TABBED pane menu (group.header.hidden === false). Mirrors buildCleanModel's
 * skeleton: Hide header / Close others / Maximize / -- / Close. `panelsInGroup`
 * drives the Close-others guard; `totalPanels` drives the Close empty-workspace
 * guard.
 */
function buildTabbedModel(
  panel: IDockviewPanel,
  panelsInGroup: number,
  totalPanels: number,
): DockMenuItem[] {
  const controls = tabbedPaneControls({
    totalPanels,
    panelsInGroup,
  });
  const close = controls.find((c) => c.id === "close")!;
  const closeOthers = controls.find((c) => c.id === "close-others")!;

  return [
    {
      label: "Hide header",
      lucide: PanelTopClose,
      command: () => void session.toggleHeaderless(panel.id),
    },
    {
      label: closeOthers.label,
      lucide: Columns2,
      disabled: closeOthers.disabled,
      command: () => void session.closeOthersInGroup(panel.id),
    },
    maximizeItem(panel),
    { separator: true },
    {
      label: close.label,
      lucide: X,
      disabled: close.disabled,
      command: () => void session.removePanelGuarded(panel.id),
    },
  ];
}

function onContextMenu(event: MouseEvent): void {
  const api = props.api;
  if (!api) return;
  const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(".dv-groupview");
  const group = api.groups.find((g) => g.element === el || g.element.contains(el as Node));
  // Over a gutter or no group at all: do nothing, let the event bubble.
  if (!group) return;

  const panel = group.activePanel ?? group.panels[0];
  if (!panel) return;

  event.preventDefault();
  event.stopPropagation();
  model.value = group.header.hidden
    ? buildCleanModel(panel, api.panels.length)
    : buildTabbedModel(panel, group.panels.length, api.panels.length);
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
  <ContextMenu ref="contextMenuRef" :model="model" data-testid="dock-context-menu">
    <template #item="{ item, props: itemProps, hasSubmenu }">
      <a
        v-bind="itemProps.action"
        :class="[
          'flex w-full items-center gap-2 text-[length:var(--density-font-size)]',
          (item as DockMenuItem).disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        ]"
      >
        <component
          :is="(item as DockMenuItem).lucide"
          v-if="(item as DockMenuItem).lucide"
          class="text-muted size-3.5"
        />
        <span class="flex-1">{{ item.label }}</span>
        <ChevronRight v-if="hasSubmenu" class="text-faint size-3.5" />
      </a>
    </template>
  </ContextMenu>
</template>
