<script setup lang="ts">
import { Eye, EyeOff, Maximize2, Minimize2, Minus, X } from "@lucide/vue";
import { computed, ref, watch } from "vue";

import IconButton from "@/components/ui/IconButton.vue";
import Slider from "@/components/ui/Slider.vue";
import { makeSetFloatAlphaCommand } from "@/modules/history/adapters";
import { useHistoryStore } from "@/stores/history";
import { useMinimizedStore } from "@/stores/minimized";
import { useSessionStore } from "@/stores/session";

import GroupCloseConfirm from "./GroupCloseConfirm.vue";
import { panelsThatWillClose } from "./groupCloseControls";

/**
 * Per-group header-actions control on `<DockviewVue>`'s right-actions slot
 * (registered globally as `commandvue-header-actions`, referenced by STRING —
 * dockview-vue's narrow `VueComponent` prop type rejects the object form). One
 * instance renders in EVERY group's header right-actions area; dockview mounts
 * it with a single `params` bag (same convention as panels — see `usePanelApi`),
 * so the dockview header-actions props arrive on `props.params`.
 *
 * It renders DIFFERENT controls per group location (Track B). In BOTH, **Close is
 * always rightmost and Minimize sits immediately to its left** (a uniform window
 * convention across docked + floating groups):
 *  - **floating** (Phase 3b/4b/4c) — `eye · maximize · minimize · close`: an
 *    **eye icon** toggling a compact background-opacity **slider** (0 = fully
 *    see-through over the map, 100 = solid glass; `session.setFloatAlpha`).
 *    Opacity is a **group** property — one `--cv-float-alpha` on the shared group
 *    element — so a multi-tab float dims uniformly and switching tabs keeps the
 *    value (`syncActiveFloatAlpha` reconciles a dragged-in tab). Then
 *    **Maximize/Restore** (fill the dock ⇄ prior box; `session.toggleFloatMaximize`),
 *    **Minimize** (to the tray; `minimized.minimizeGroup`), and **Close**
 *    (`session.removePanelGuarded`).
 *  - **grid / tabbed** (Phase 4a/4c) — `minimize · close`: a **Minimize** button
 *    that collapses the whole group to the bottom-left tray
 *    (`minimized.minimizeGroup`), then a **Close All** button (the plain close `X`,
 *    a touch larger than the per-tab close) that closes every panel in the group
 *    at once (`session.closeAllInGroup`, empty-workspace-guarded) AFTER a
 *    group-scoped confirm (`GroupCloseConfirm`).
 *
 * `@pointerdown.stop` / `@mousedown.stop` keep a click/drag of these controls
 * from also dragging the group (the header doubles as the move handle).
 */
interface HeaderActionsParams {
  api?: { location?: { type?: string } };
  activePanel?: { id?: string };
  /** Present on dockview's `updateLocation` fast-path, which replaces `params`
   *  with just `{ location }` (stripping `api` / `activePanel`). */
  location?: { type?: string };
  /** This group's panels (full props only) — the Close All count source. */
  panels?: unknown[];
  /** The whole-layout DockviewApi (full props only); `.panels` is every pane. */
  containerApi?: { panels?: unknown[] };
}
const props = defineProps<{ params?: HeaderActionsParams }>();
const session = useSessionStore();
const minimized = useMinimizedStore();
const history = useHistoryStore();

// `api.location` on the full props; `location` on the updateLocation fast-path.
const isFloating = computed(
  () =>
    props.params?.api?.location?.type === "floating" || props.params?.location?.type === "floating",
);
const isGrid = computed(
  () => props.params?.api?.location?.type === "grid" || props.params?.location?.type === "grid",
);

// `activePanel` is absent on the updateLocation fast-path, so cache the last
// known id. A float is single-panel; for a tabbed grid group the active id is
// always a member of the group, and the group-level action (Close All) operates
// off any member's `.group`, so a fast-path-stale-but-in-group id is still
// correct.
const cachedPanelId = ref<string>();
watch(
  () => props.params?.activePanel?.id,
  (id) => {
    if (id) cachedPanelId.value = id;
    // Float opacity is a GROUP property persisted per-panel, so reconcile the
    // newly-active float tab with the group's actual glass (a tab dragged into a
    // dimmed float would otherwise read its own value). Dirty-neutral no-op when
    // already in sync or off a float. Reconciliation hooks the active-tab change
    // (the dominant case — dockview activates a dropped tab); a drop that does NOT
    // re-activate self-heals on the next tab switch. Relies on `applyFloatAlphas`
    // (run synchronously in loadLayout) having set the var before this `immediate`
    // watch fires at mount, so an active dimmed tab never reads an unset var.
    if (id && isFloating.value) void session.syncActiveFloatAlpha(id);
  },
  { immediate: true },
);
const panelId = computed(() => props.params?.activePanel?.id ?? cachedPanelId.value);

const pct = computed<number>({
  get: () => (panelId.value ? Math.round(session.getFloatAlpha(panelId.value) * 100) : 100),
  set: (next) => {
    // Route through history so an opacity drag is one coalesced undo step.
    if (panelId.value) {
      void history.execute(makeSetFloatAlphaCommand(panelId.value, next / 100));
    }
  },
});

const open = ref(false);

// Float window controls (Phase 4b): Maximize ⇄ Restore + Close, in the eye row.
// `isMax` reads the persisted flag so the icon/label flip survives reload.
const isMax = computed(() => (panelId.value ? session.getFloatMaximized(panelId.value) : false));
function toggleMaximize() {
  if (panelId.value) void session.toggleFloatMaximize(panelId.value);
}
function closeWindow() {
  if (panelId.value) void session.removePanelGuarded(panelId.value);
}

// Minimize the whole group to the bottom-left tray (Phase 4c). Same action from
// the grid branch (beside Close All) and the float branch (beside maximize/close).
function minimizeGroup() {
  if (panelId.value) void minimized.minimizeGroup(panelId.value);
}

// Close All flows through a group-scoped confirm (GroupCloseConfirm) rather than
// closing immediately. `gridRootEl` anchors the Teleport to THIS group's
// `.dv-groupview`; a guard-aware count (see `groupCloseControls`) drives the
// confirm message.
const gridRootEl = ref<HTMLElement>();
const confirmOpen = ref(false);
const confirmTarget = ref<HTMLElement>();
const confirmCount = ref(0);

function requestCloseAll() {
  const groupEl = gridRootEl.value?.closest<HTMLElement>(".dv-groupview") ?? undefined;
  if (!groupEl || !panelId.value) return;
  // Count what Close All will ACTUALLY remove. Prefer the dockview API (the same
  // source `closeAllInGroup` iterates); fall back to the tab DOM only if absent.
  const groupPanels = props.params?.panels?.length ?? groupEl.querySelectorAll(".dv-tab").length;
  const total = props.params?.containerApi?.panels?.length ?? groupPanels;
  const willClose = panelsThatWillClose(groupPanels, total);
  if (willClose <= 0) return; // single-pane whole layout → Close All is a no-op
  confirmTarget.value = groupEl;
  confirmCount.value = willClose;
  confirmOpen.value = true;
}
function confirmCloseAll() {
  // Hide the confirm BEFORE removing panels: `closeAllInGroup` mutates
  // synchronously (no await before `api.removePanel`), so in the multi-group case
  // the group — and this confirm's Teleport target — is torn down in the same
  // tick; flipping `confirmOpen` first lets the overlay detach cleanly.
  confirmOpen.value = false;
  if (panelId.value) void session.closeAllInGroup(panelId.value);
}
function cancelCloseAll() {
  confirmOpen.value = false;
}
</script>

<template>
  <div v-if="isFloating" class="flex items-center gap-1.5" @pointerdown.stop @mousedown.stop>
    <div v-if="open" class="flex items-center gap-2 pl-1">
      <Slider v-model="pct" :min="0" :max="100" class="w-24" />
      <span class="text-muted w-7 text-right text-[10px] tabular-nums">{{ pct }}%</span>
    </div>
    <IconButton
      :label="open ? 'Hide opacity slider' : 'Window opacity'"
      size="sm"
      @click="open = !open"
    >
      <component :is="open ? EyeOff : Eye" />
    </IconButton>
    <IconButton
      :label="isMax ? 'Restore window' : 'Maximize window'"
      size="sm"
      @click="toggleMaximize"
    >
      <component :is="isMax ? Minimize2 : Maximize2" />
    </IconButton>
    <IconButton label="Minimize window" size="sm" @click="minimizeGroup">
      <Minus />
    </IconButton>
    <IconButton label="Close window" size="sm" @click="closeWindow">
      <X />
    </IconButton>
  </div>
  <div
    v-else-if="isGrid"
    ref="gridRootEl"
    class="flex items-center pr-1"
    @pointerdown.stop
    @mousedown.stop
  >
    <IconButton label="Minimize group" size="sm" @click="minimizeGroup">
      <Minus />
    </IconButton>
    <IconButton
      label="Close all panels in group"
      size="sm"
      class="[&_svg]:size-[14px]"
      @click="requestCloseAll"
    >
      <X />
    </IconButton>
    <GroupCloseConfirm
      :open="confirmOpen"
      :target="confirmTarget"
      :count="confirmCount"
      @confirm="confirmCloseAll"
      @cancel="cancelCloseAll"
    />
  </div>
</template>
