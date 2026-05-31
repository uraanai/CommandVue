<script setup lang="ts">
import type { DockviewApi, IDockviewPanel } from "dockview-vue";
import type { MenuItem } from "primevue/menuitem";

import { PanelTop, PanelTopClose, SquareSplitHorizontal, X } from "@lucide/vue";
import { computed, onUnmounted, ref, shallowRef, watch, type Component } from "vue";

import IconButton from "@/components/ui/IconButton.vue";
import { panelRegistry } from "@/modules/panels/registry";
import { UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
import { useSessionStore } from "@/stores/session";
import Menu from "@/volt/Menu.vue";

import { cleanPaneControls } from "./cleanPaneControls";

/**
 * Hover overlay for clean (header-less) panes. CUSTOM by necessity: dockview
 * exposes no slot to inject per-group chrome on a header-hidden group, so the
 * controls have to be positioned over the group's DOM rect from outside the
 * dock. The rect math lives here; the pure button-set decision logic lives in
 * `cleanPaneControls.ts` (unit-tested). This component is Stage-1
 * Playwright-verified per the CommandVue verification protocol — no unit test.
 *
 * The dock root element is supplied via the `root` PROP (DockLayout owns the
 * positioned wrapper): the DockviewApi itself has no `.element`, so pointer
 * tracking listens on `root` and resolves the hovered `.dv-groupview` back to
 * its dockview group via `api.groups`.
 *
 * The Split control opens a PANEL PICKER (volt/Menu in popup mode) listing the
 * registered panel types; selecting one calls `session.splitCleanNeighbor`
 * with the chosen type — the new pane's content is the user's choice, never a
 * hardcoded duplicate.
 */
const props = defineProps<{ api: DockviewApi | null; root: HTMLElement | null }>();
const session = useSessionStore();

const hoveredGroupId = ref<string | null>(null);
const rect = ref<{ top: number; left: number; width: number } | null>(null);
const hoveredPanel = shallowRef<IDockviewPanel | null>(null);
const disposers: Array<() => void> = [];

const menuRef = ref<InstanceType<typeof Menu> | null>(null);

/**
 * Grace-period hide state. The overlay is Teleported to <body> and positioned
 * `fixed` ON TOP of the dock root — it is NOT a DOM descendant of `root`. So the
 * moment the cursor crosses from a clean pane onto the overlay's buttons (or the
 * Split picker popup, also teleported), the browser fires `pointerleave` on
 * `root`. An immediate `clearHover()` there unmounts the overlay mid-handoff,
 * the cursor lands back on the pane, `pointerover` re-mounts it — an infinite
 * flicker that detaches the buttons before they can be clicked.
 *
 * Fix: never clear synchronously on leave. `scheduleHide()` arms a short timer;
 * `cancelHide()` disarms it. The overlay's OWN `pointerenter` cancels the timer
 * armed by root's `pointerleave`, bridging the gap. `isPickerOpen` suppresses
 * hiding entirely while the Split menu is open (moving onto its items also fires
 * root's `pointerleave`, and we must not empty `pickerItems` mid-interaction).
 */
const HIDE_GRACE_MS = 150;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
const isPickerOpen = ref(false);

function cancelHide(): void {
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function scheduleHide(): void {
  // While the picker is open the overlay must stay put — its source panel id is
  // captured in `pickerItems`, and the menu lives over the same group.
  if (isPickerOpen.value) return;
  cancelHide();
  hideTimer = setTimeout(() => {
    hideTimer = null;
    clearHover();
  }, HIDE_GRACE_MS);
}

const iconMap: Record<string, Component> = {
  PanelTop,
  PanelTopClose,
  SquareSplitHorizontal,
  X,
};

const visible = computed(() => Boolean(hoveredGroupId.value && rect.value && hoveredPanel.value));

const controls = computed(() => {
  const api = props.api;
  const panel = hoveredPanel.value;
  if (!api || !panel) return [];
  return cleanPaneControls({
    isHeaderless: panel.api.group.header.hidden,
    totalPanels: api.panels.length,
  });
});

/**
 * Registered panel types eligible as a split target — the synthetic
 * `__unassigned__` namespace and the components-browser shell are filtered out
 * (splitting into either would be nonsensical), mirroring MenuBar's
 * Add-Component picker.
 */
const panelChoices = computed(() =>
  panelRegistry
    .list()
    .filter((d) => d.id !== UNASSIGNED_PANEL_TYPE && d.id !== "components-browser"),
);

/**
 * Build the picker model fresh each open so the source panel id is captured at
 * click time. Each command splits a clean neighbor of the chosen type, then
 * clears the hover so the overlay doesn't linger over the now-resized group.
 */
const pickerItems = computed<MenuItem[]>(() => {
  const panel = hoveredPanel.value;
  if (!panel) return [];
  const sourceId = panel.id;
  return panelChoices.value.map((def) => ({
    label: def.title,
    command: () => {
      void splitInto(sourceId, def.id);
    },
  }));
});

async function splitInto(sourceId: string, panelType: string): Promise<void> {
  await session.splitCleanNeighbor(sourceId, panelType);
  clearHover();
}

function clearHover(): void {
  cancelHide();
  hoveredGroupId.value = null;
  hoveredPanel.value = null;
  rect.value = null;
}

function onPointerOver(event: PointerEvent): void {
  const api = props.api;
  if (!api) return;
  const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(".dv-groupview");
  const group = api.groups.find((g) => g.element === el || g.element.contains(el as Node));
  if (!group || !group.header.hidden) {
    // Over a non-clean / tabbed group (or no group): defer the hide so a brief
    // pass over a gutter or header doesn't yank the overlay away mid-handoff.
    scheduleHide();
    return;
  }
  // Over a clean group: (re)assert the hover and cancel any pending hide.
  cancelHide();
  const r = group.element.getBoundingClientRect();
  hoveredGroupId.value = group.id;
  hoveredPanel.value = group.panels[0] ?? null;
  rect.value = { top: r.top, left: r.left, width: r.width };
}

/** root `pointerleave` — defer, don't clear: the cursor may be moving onto the
 *  teleported overlay/picker (separate elements on top of `root`). */
function onRootPointerLeave(): void {
  scheduleHide();
}

/** Pointer entered the overlay cluster itself — keep it mounted. */
function onOverlayPointerEnter(): void {
  cancelHide();
}

/** Pointer left the overlay cluster — defer the hide (the picker, if open,
 *  suppresses it; otherwise the grace timer dismisses once the cursor settles). */
function onOverlayPointerLeave(): void {
  scheduleHide();
}

/** Split picker opened — pin the overlay open until the menu hides. */
function onPickerShow(): void {
  isPickerOpen.value = true;
  cancelHide();
}

/** Split picker hidden (selection made or dismissed) — allow hiding again. */
function onPickerHide(): void {
  isPickerOpen.value = false;
  scheduleHide();
}

/** toggle-header / close run directly; split opens the picker. */
async function runControl(id: string, event: MouseEvent): Promise<void> {
  const panel = hoveredPanel.value;
  if (!panel) return;
  if (id === "split") {
    // Pin before toggling so the root `pointerleave` fired as the popup grabs
    // the pointer can't schedule a hide in the gap before `@show` lands.
    isPickerOpen.value = true;
    cancelHide();
    menuRef.value?.toggle(event);
    return;
  }
  if (id === "toggle-header") await session.toggleHeaderless(panel.id);
  else if (id === "close") await session.removePanelGuarded(panel.id);
  clearHover();
}

watch(
  () => [props.api, props.root] as const,
  ([api, root]) => {
    for (const d of disposers.splice(0)) d();
    if (!api || !root) return;
    root.addEventListener("pointerover", onPointerOver as EventListener);
    root.addEventListener("pointerleave", onRootPointerLeave);
    disposers.push(() => root.removeEventListener("pointerover", onPointerOver as EventListener));
    disposers.push(() => root.removeEventListener("pointerleave", onRootPointerLeave));
    const sub = api.onDidLayoutChange(() => clearHover());
    disposers.push(() => sub.dispose());
  },
  { immediate: true },
);

onUnmounted(() => {
  cancelHide();
  for (const d of disposers.splice(0)) d();
});

const overlayStyle = computed(() =>
  rect.value
    ? {
        top: `${rect.value.top + 6}px`,
        left: `${rect.value.left + rect.value.width - 6}px`,
        transform: "translateX(-100%)",
      }
    : {},
);

function iconFor(name: string): Component {
  return iconMap[name] ?? X;
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="border-border bg-surface-raised pointer-events-auto fixed z-40 flex items-center gap-0.5 rounded-md border p-1 shadow-xl"
      :style="overlayStyle"
      data-testid="clean-pane-overlay"
      @pointerenter="onOverlayPointerEnter"
      @pointerleave="onOverlayPointerLeave"
      @mousedown.stop
      @click.stop
    >
      <IconButton
        v-for="c in controls"
        :key="c.id"
        :label="c.label"
        :disabled="c.disabled"
        size="sm"
        :data-control="c.id"
        @mousedown.stop
        @click.stop="runControl(c.id, $event)"
      >
        <component :is="iconFor(c.icon)" />
      </IconButton>
    </div>
  </Teleport>

  <!-- Split picker: popup Menu of registered panel types. Rendered outside the
       rect-positioned cluster so its own popup positioning (anchored at the
       Split-button click event) isn't clipped by the overlay container. The
       popup is itself teleported to <body>, so moving onto its items fires
       root's `pointerleave`; `@show`/`@hide` pin/unpin the overlay across that.
       (PrimeVue Menu emits `show`/`hide`; the events fall through the Volt
       wrapper to the inner Menu since it has no `inheritAttrs: false`.) -->
  <Menu
    id="clean-pane-split-picker"
    ref="menuRef"
    :model="pickerItems"
    popup
    @show="onPickerShow"
    @hide="onPickerHide"
  />
</template>
