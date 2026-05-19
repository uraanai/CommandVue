<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const panelKey = computed(() => {
  const raw = route.query.panel;
  return typeof raw === "string" ? raw : null;
});

const panel = computed<Component | null>(() => {
  switch (panelKey.value) {
    case "cesium":
      return defineAsyncComponent(() => import("@/components/panels/CesiumPanel.vue"));
    case "maplibre":
      return defineAsyncComponent(() => import("@/components/panels/MapLibrePanel.vue"));
    case "entities":
      return defineAsyncComponent(() => import("@/components/panels/EntityListPanel.vue"));
    case "chart":
      return defineAsyncComponent(() => import("@/components/panels/ChartPanel.vue"));
    case "telemetry":
      return defineAsyncComponent(() => import("@/components/panels/TelemetryPanel.vue"));
    case "symbology":
      return defineAsyncComponent(() => import("@/components/panels/SymbologyPanel.vue"));
    case "markdown":
      return defineAsyncComponent(() => import("@/components/panels/MarkdownPanel.vue"));
    default:
      return null;
  }
});

const panels = [
  { key: "cesium", label: "Cesium 3D" },
  { key: "maplibre", label: "MapLibre 2D" },
  { key: "entities", label: "Entities" },
  { key: "chart", label: "Chart" },
  { key: "telemetry", label: "Telemetry" },
  { key: "symbology", label: "Symbology" },
  { key: "markdown", label: "Markdown" },
];
</script>

<template>
  <div class="flex h-full flex-col gap-3 p-4">
    <header class="flex flex-wrap items-center gap-2 text-xs">
      <span class="text-foreground font-medium">Panel showcase</span>
      <span v-if="panelKey" class="text-muted">· {{ panelKey }}</span>
      <span v-else class="text-muted">· no panel selected</span>

      <div class="ml-auto flex flex-wrap items-center gap-1">
        <RouterLink
          v-for="p in panels"
          :key="p.key"
          :to="{ name: 'demo', query: { panel: p.key } }"
          active-class="bg-surface-sunken text-foreground"
          class="text-muted hover:text-foreground hover:bg-surface-sunken rounded px-2 py-1"
        >
          {{ p.label }}
        </RouterLink>
      </div>
    </header>

    <div class="border-border min-h-0 flex-1 overflow-hidden rounded-md border">
      <component :is="panel" v-if="panel" />
      <div
        v-else
        class="text-muted flex h-full w-full flex-col items-center justify-center gap-2 text-sm"
      >
        <p>No panel selected.</p>
        <p class="text-xs">
          Try
          <code class="bg-surface-sunken rounded px-1 py-0.5">/demo?panel=cesium</code>
          or pick a tab above.
        </p>
      </div>
    </div>
  </div>
</template>
