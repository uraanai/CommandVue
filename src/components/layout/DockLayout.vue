<script setup lang="ts">
import "dockview-vue/dist/styles/dockview.css";

import "@/assets/styles/dockview.css";

import { DockviewVue, type DockviewApi, type DockviewReadyEvent } from "dockview-vue";
import { defineAsyncComponent, onUnmounted, provide, shallowRef } from "vue";

import { useLayoutStore } from "@/stores/layout";

import { resetLayoutKey } from "./keys";

const layout = useLayoutStore();

const components = {
  cesium: defineAsyncComponent(() => import("@/components/panels/CesiumPanel.vue")),
  maplibre: defineAsyncComponent(() => import("@/components/panels/MapLibrePanel.vue")),
  entities: defineAsyncComponent(() => import("@/components/panels/EntityListPanel.vue")),
  chart: defineAsyncComponent(() => import("@/components/panels/ChartPanel.vue")),
  telemetry: defineAsyncComponent(() => import("@/components/panels/TelemetryPanel.vue")),
  symbology: defineAsyncComponent(() => import("@/components/panels/SymbologyPanel.vue")),
  markdown: defineAsyncComponent(() => import("@/components/panels/MarkdownPanel.vue")),
};

const apiRef = shallowRef<DockviewApi | null>(null);

function buildDefaultLayout(api: DockviewApi) {
  api.addPanel({ id: "cesium", component: "cesium", title: "3D Globe" });
  api.addPanel({
    id: "maplibre",
    component: "maplibre",
    title: "2D Map",
    position: { referencePanel: "cesium", direction: "within" },
  });
  api.addPanel({
    id: "entities",
    component: "entities",
    title: "Entities",
    position: { referencePanel: "cesium", direction: "right" },
  });
  api.addPanel({
    id: "markdown",
    component: "markdown",
    title: "Briefing",
    position: { referencePanel: "entities", direction: "within" },
  });
  api.addPanel({
    id: "chart",
    component: "chart",
    title: "Telemetry",
    position: { referencePanel: "cesium", direction: "below" },
  });
  api.addPanel({
    id: "telemetry",
    component: "telemetry",
    title: "Live feed",
    position: { referencePanel: "chart", direction: "within" },
  });
  api.addPanel({
    id: "symbology",
    component: "symbology",
    title: "Symbology",
    position: { referencePanel: "chart", direction: "within" },
  });

  api.getPanel("cesium")?.api.setActive();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(api: DockviewApi) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void layout.save(api.toJSON());
    saveTimer = null;
  }, 400);
}

async function onReady(event: DockviewReadyEvent) {
  apiRef.value = event.api;

  const stored = await layout.load();
  if (stored) {
    try {
      event.api.fromJSON(stored as Parameters<DockviewApi["fromJSON"]>[0]);
    } catch {
      event.api.clear();
      buildDefaultLayout(event.api);
    }
  } else {
    buildDefaultLayout(event.api);
  }

  event.api.onDidLayoutChange(() => schedulePersist(event.api));
}

function resetLayout() {
  const api = apiRef.value;
  if (!api) return;
  api.clear();
  buildDefaultLayout(api);
  void layout.reset();
}

provide(resetLayoutKey, resetLayout);

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer);
});
</script>

<template>
  <DockviewVue
    :components="components"
    class="dockview-theme-commandvue h-full w-full"
    @ready="onReady"
  />
</template>
