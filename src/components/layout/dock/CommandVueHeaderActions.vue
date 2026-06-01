<script setup lang="ts">
import { Eye, EyeOff, SquareX } from "@lucide/vue";
import { computed, ref, watch } from "vue";

import IconButton from "@/components/ui/IconButton.vue";
import { useSessionStore } from "@/stores/session";
import Slider from "@/volt/Slider.vue";

/**
 * Per-group header-actions control on `<DockviewVue>`'s right-actions slot
 * (registered globally as `commandvue-header-actions`, referenced by STRING —
 * dockview-vue's narrow `VueComponent` prop type rejects the object form). One
 * instance renders in EVERY group's header right-actions area; dockview mounts
 * it with a single `params` bag (same convention as panels — see `usePanelApi`),
 * so the dockview header-actions props arrive on `props.params`.
 *
 * It renders DIFFERENT controls per group location (Track B):
 *  - **floating** (Phase 3b): an **eye icon** that toggles a compact background-
 *    opacity **slider** (0 = fully see-through over the map, 100 = solid glass),
 *    driving `session.setFloatAlpha`.
 *  - **grid / tabbed** (Phase 4a): a **Close All** button that closes every panel
 *    in the group at once (`session.closeAllInGroup`, empty-workspace-guarded) —
 *    the group-level complement to the per-tab close. (Minimize-to-tray joins
 *    this branch in Phase 4c.)
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
}
const props = defineProps<{ params?: HeaderActionsParams }>();
const session = useSessionStore();

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
  },
  { immediate: true },
);
const panelId = computed(() => props.params?.activePanel?.id ?? cachedPanelId.value);

const pct = computed<number>({
  get: () => (panelId.value ? Math.round(session.getFloatAlpha(panelId.value) * 100) : 100),
  set: (next) => {
    if (panelId.value) void session.setFloatAlpha(panelId.value, next / 100);
  },
});

const open = ref(false);

function closeAll() {
  if (panelId.value) void session.closeAllInGroup(panelId.value);
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
  </div>
  <div v-else-if="isGrid" class="flex items-center pr-1" @pointerdown.stop @mousedown.stop>
    <IconButton label="Close all panels in group" size="sm" @click="closeAll">
      <SquareX />
    </IconButton>
  </div>
</template>
