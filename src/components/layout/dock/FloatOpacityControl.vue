<script setup lang="ts">
import { Eye, EyeOff } from "@lucide/vue";
import { computed, ref, watch } from "vue";

import IconButton from "@/components/ui/IconButton.vue";
import { useSessionStore } from "@/stores/session";
import Slider from "@/volt/Slider.vue";

/**
 * Right header-actions control for floating windows (Track B Phase 3b).
 *
 * Registered as `right-header-actions-component` on `<DockviewVue>`, so dockview
 * renders it in every group's header right-actions area — but it shows ONLY for
 * floating groups. dockview-vue mounts actions components with a single `params`
 * bag (same convention as panels — see `usePanelApi`), so the dockview
 * header-actions props arrive on `props.params`.
 *
 * UI: an **eye icon** on the right of the float header. Clicking it toggles a
 * compact opacity **slider** (kept hidden by default so the header stays clean);
 * the slider drives `session.setFloatAlpha` (the float's background see-through:
 * 0 = fully transparent so only content shows over the map, 100 = solid glass).
 * `@pointerdown.stop` / `@mousedown.stop` keep a drag of the slider from also
 * dragging the float (the header doubles as the float's move handle).
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

// `activePanel` is absent on the updateLocation fast-path, so cache the last
// known id. A floating group is single-panel, so the cache never goes stale.
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
</template>
