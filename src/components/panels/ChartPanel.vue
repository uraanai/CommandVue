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
import { computed, onBeforeUnmount, onMounted } from "vue";
import VChart from "vue-echarts";

import { useTelemetryStore } from "@/stores/telemetry";

use([CanvasRenderer, LineChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent]);

const telemetry = useTelemetryStore();

// Synthetic 1 Hz signal — sine wave plus noise. Real data is plumbed in
// later by panels that consume `useWebSocketClient`'s `lastMessage`.
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  timer = setInterval(() => {
    const t = Date.now();
    const value = 50 + 30 * Math.sin(t / 4000) + Math.random() * 4 - 2;
    telemetry.appendSignal(value, t);
  }, 1000);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
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
  <div class="bg-surface-sunken h-full w-full">
    <VChart class="h-full w-full" :option="option" autoresize />
  </div>
</template>
