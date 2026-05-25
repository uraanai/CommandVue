<script setup lang="ts">
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import VChart from "vue-echarts";

import { useTelemetryStore } from "@/stores/telemetry";

use([CanvasRenderer, LineChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent]);

const telemetry = useTelemetryStore();

const host = ref<HTMLDivElement | null>(null);
const ready = ref(false);
let resizeObserver: ResizeObserver | null = null;

// Synthetic 1 Hz signal — sine wave plus noise. Real data is plumbed in
// later by panels that consume `useWebSocketClient`'s `lastMessage`.
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  // Dockview can mount panels in a 0×0 container (floating-before-position,
  // hidden tab, etc.). Initializing ECharts then prints a "Can't get DOM
  // width or height" warning. Gate the chart on a ResizeObserver so it only
  // renders once the host has real dimensions.
  if (host.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) ready.value = true;
    });
    resizeObserver.observe(host.value);
  }
  timer = setInterval(() => {
    const t = Date.now();
    const value = 50 + 30 * Math.sin(t / 4000) + Math.random() * 4 - 2;
    telemetry.appendSignal(value, t);
  }, 1000);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  resizeObserver?.disconnect();
  resizeObserver = null;
});

const option = computed(() => ({
  grid: { top: 24, right: 18, bottom: 28, left: 38 },
  tooltip: { trigger: "axis" },
  xAxis: {
    type: "time",
    axisLabel: { fontSize: 10, color: "#94a3b8" },
    axisLine: { lineStyle: { color: "#334155" } },
    splitLine: { show: false },
  },
  yAxis: {
    type: "value",
    axisLabel: { fontSize: 10, color: "#94a3b8" },
    splitLine: { lineStyle: { color: "#1e293b" } },
  },
  series: [
    {
      type: "line",
      name: "Telemetry",
      smooth: true,
      symbol: "none",
      lineStyle: { color: "#3b82f6", width: 2 },
      areaStyle: { color: "rgba(59, 130, 246, 0.15)" },
      data: telemetry.signalSeries.map((p) => [p.ts, p.value]),
    },
  ],
  animation: false,
}));
</script>

<template>
  <div ref="host" class="bg-surface-sunken h-full w-full">
    <VChart v-if="ready" class="h-full w-full" :option="option" autoresize />
  </div>
</template>
