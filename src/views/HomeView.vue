<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
    <header class="space-y-3">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400">CommandVue</p>
      <h1 class="text-4xl font-semibold text-slate-50">Command-center foundation, batteries included.</h1>
      <p class="max-w-prose text-slate-400">
        A production-grade Vue 3 template for operations dashboards: command-and-control, fleet
        monitoring, geospatial operations, and real-time telemetry. The full demo dock (Cesium
        globe, MapLibre 2D map, entity table, telemetry chart, symbology grid, markdown briefing)
        lights up in Phase 4.
      </p>
    </header>

    <nav class="flex gap-3 text-sm">
      <RouterLink
        to="/demo"
        class="rounded-md border border-slate-700 px-4 py-2 hover:bg-slate-800"
      >
        Panel showcase
      </RouterLink>
      <RouterLink
        to="/about"
        class="rounded-md border border-slate-700 px-4 py-2 hover:bg-slate-800"
      >
        About
      </RouterLink>
    </nav>
  </main>
</template>
