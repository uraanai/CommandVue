<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="min-h-screen flex flex-col gap-6 p-8 max-w-3xl mx-auto">
    <header class="space-y-2">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400">About</p>
      <h1 class="text-2xl font-semibold text-slate-50">CommandVue</h1>
      <p class="text-sm text-slate-400">
        A production-grade Vue 3 template for operations dashboards.
      </p>
    </header>

    <section class="space-y-2 text-sm text-slate-300">
      <p>
        CommandVue ships with a curated, opinionated stack: Vue 3 + Vite + TypeScript, Pinia, Vue
        Router, Dockview, PrimeVue (unstyled) + Tailwind v4, Cesium 3D globe, MapLibre 2D map,
        standardized operational symbology via milsymbol, ECharts, TanStack Table, native
        WebSocket, and a tool registry pattern for measure / draw / select interactions.
      </p>
      <p>
        It is a <strong class="text-slate-100">template</strong> — generic, brand-overridable, free
        of any project-specific business logic. Use it as the foundation for operations dashboards:
        command-and-control, fleet monitoring, geospatial operations, mission planning, and
        real-time telemetry.
      </p>
    </section>

    <section class="space-y-2 text-sm text-slate-300">
      <h2 class="text-base font-semibold text-slate-100">Credits</h2>
      <p>
        Built and maintained by
        <a class="text-sky-400 hover:underline" href="https://uraanai.com" rel="noopener">Uraan AI</a>.
        Inspired by
        <a
          class="text-sky-400 hover:underline"
          href="https://github.com/orbat-mapper/orbat-mapper"
          rel="noopener"
          >orbat-mapper</a
        >.
      </p>
      <p>Licensed under Apache 2.0. See the LICENSE file in the repository root.</p>
    </section>

    <RouterLink to="/" class="text-sm text-slate-400 hover:text-slate-200">← Back home</RouterLink>
  </main>
</template>
