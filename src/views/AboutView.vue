<script setup lang="ts">
//
</script>

<template>
  <main class="mx-auto flex h-full max-w-3xl flex-col gap-6 overflow-auto p-8">
    <header class="space-y-2">
      <p class="text-faint text-xs tracking-[0.3em] uppercase">About</p>
      <h1 class="text-foreground text-2xl font-semibold">CommandVue</h1>
      <p class="text-muted text-sm">A production-grade Vue 3 template for operations dashboards.</p>
    </header>

    <section class="text-muted space-y-2 text-sm">
      <p>
        CommandVue ships with a curated, opinionated stack: Vue 3 + Vite + TypeScript, Pinia, Vue
        Router, Dockview, PrimeVue (unstyled) + Tailwind v4, Cesium 3D globe, MapLibre 2D map,
        standardized operational symbology via milsymbol, ECharts, TanStack Table, native WebSocket,
        and a tool registry pattern for measure / draw / select interactions.
      </p>
      <p>
        It is a <strong class="text-foreground">template</strong> — generic, brand-overridable, free
        of any project-specific business logic. Use it as the foundation for operations dashboards:
        command-and-control, fleet monitoring, geospatial operations, mission planning, and
        real-time telemetry.
      </p>
    </section>

    <section class="text-muted space-y-2 text-sm">
      <h2 class="text-foreground text-base font-semibold">Credits</h2>
      <p>
        Built and maintained by
        <a
          class="text-accent-500 hover:underline"
          href="https://uraanai.com"
          rel="noopener"
          target="_blank"
        >
          Uraan AI </a
        >. Inspired by
        <a
          class="text-accent-500 hover:underline"
          href="https://github.com/orbat-mapper/orbat-mapper"
          rel="noopener"
          target="_blank"
        >
          orbat-mapper </a
        >.
      </p>
      <p>Licensed under Apache 2.0. See the LICENSE file in the repository root.</p>
    </section>
  </main>
</template>
