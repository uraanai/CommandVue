/* eslint-disable */
// Copy-paste template for adding a new panel.
//
// 1. Build src/components/panels/MyPanel.vue with the shape below.
// 2. Add the app.component() registration in src/main.ts.
// 3. Add the panelRegistry entry in src/modules/panels/builtin.ts.
// 4. (Optional) Add the id to SEED_PANEL_TYPES in src/modules/storage/seed.ts.

// ─── src/components/panels/MyPanel.vue ────────────────────────────────────
/*
<script setup lang="ts">
import type { DockviewPanelApi } from "dockview-vue";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import { usePanelState } from "@/composables/usePanelState";
import {
  registerPanelInstance,
  unregisterPanelInstance,
} from "@/modules/panels/instances";

interface MyState extends Record<string, unknown> {
  zoom: number;
  filter: string;
}

interface Props {
  api?: DockviewPanelApi;
}

const props = defineProps<Props>();

const zoom = ref(1);
const filter = ref("");

const handle = {
  // Public imperative API for preset application:
  setZoom: (n: number) => (zoom.value = n),
};

onMounted(() => {
  if (!props.api) return;
  registerPanelInstance(props.api.id, handle);

  const { save } = usePanelState<MyState>(props.api.id, {
    serialize: () => ({ zoom: zoom.value, filter: filter.value }),
    restore: (state) => {
      zoom.value = state.zoom ?? 1;
      filter.value = state.filter ?? "";
    },
  });

  watch([zoom, filter], save);
});

onBeforeUnmount(() => {
  if (props.api) unregisterPanelInstance(props.api.id);
});
</script>

<template>
  <div class="bg-surface h-full w-full">
    <!-- panel UI -->
  </div>
</template>
*/

// ─── src/main.ts ──────────────────────────────────────────────────────────
/*
app.component(
  "my-panel",
  defineAsyncComponent(() => import("@/components/panels/MyPanel.vue")),
);
*/

// ─── src/modules/panels/builtin.ts ────────────────────────────────────────
/*
{
  id: "my-panel",
  title: "My Panel",
  description: "What it does.",
  icon: "square",         // Lucide icon name
  category: "tools",      // one of: maps | data | charts | docs | monitoring | tools
  component: () => import("@/components/panels/MyPanel.vue"),
}
*/

export {};
