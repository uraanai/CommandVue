<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'

const route = useRoute()
const selectedPanel = computed(() => {
  const raw = route.query.panel
  return typeof raw === 'string' ? raw : null
})
</script>

<template>
  <main class="min-h-screen flex flex-col gap-6 p-8">
    <header class="space-y-2">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400">CommandVue · Demo</p>
      <h1 class="text-2xl font-semibold text-slate-50">Panel showcase</h1>
      <p class="text-sm text-slate-400">
        Individual panels can be loaded in isolation via the
        <code class="rounded bg-slate-800 px-1 py-0.5 text-xs">?panel=</code> query parameter — for
        example
        <code class="rounded bg-slate-800 px-1 py-0.5 text-xs">/demo?panel=cesium</code>.
        Panels are wired in Phase 5 and Phase 6.
      </p>
    </header>

    <section
      class="flex-1 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-8 text-sm text-slate-300"
    >
      <p v-if="selectedPanel">
        Requested panel: <code class="rounded bg-slate-800 px-1 py-0.5">{{ selectedPanel }}</code>
      </p>
      <p v-else>No panel selected. Pass <code>?panel=cesium</code> (or another key) to mount one.</p>
    </section>

    <RouterLink to="/" class="text-sm text-slate-400 hover:text-slate-200">← Back home</RouterLink>
  </main>
</template>
