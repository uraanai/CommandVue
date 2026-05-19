<script setup lang="ts">
import { Moon, Sun } from "@lucide/vue";
import { ref } from "vue";
import { RouterLink } from "vue-router";

import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import IconButton from "@/components/ui/IconButton.vue";
import { useTheme } from "@/composables/useTheme";

const { isDark, toggle } = useTheme();
const showDialog = ref(false);
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
    <header class="space-y-3">
      <p class="text-faint text-xs tracking-[0.3em] uppercase">CommandVue</p>
      <h1 class="text-foreground text-4xl font-semibold text-balance">
        Operations-dashboard foundation, batteries included.
      </h1>
      <p class="text-muted mx-auto max-w-prose text-pretty">
        A production-grade Vue 3 template for command-and-control, fleet monitoring, geospatial
        operations, and real-time telemetry. The full dock (Cesium globe, MapLibre 2D map, entity
        table, telemetry chart, symbology grid, markdown briefing) lights up in Phase 4.
      </p>
    </header>

    <nav class="flex flex-wrap items-center justify-center gap-3 text-sm">
      <RouterLink
        to="/demo"
        class="border-border text-foreground hover:bg-surface-raised rounded-md border px-4 py-2 transition-colors"
      >
        Panel showcase
      </RouterLink>
      <RouterLink
        to="/about"
        class="border-border text-foreground hover:bg-surface-raised rounded-md border px-4 py-2 transition-colors"
      >
        About
      </RouterLink>
      <Button variant="primary" @click="showDialog = true"> Open dialog </Button>
      <IconButton
        :label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        variant="ghost"
        @click="toggle()"
      >
        <Sun v-if="isDark" />
        <Moon v-else />
      </IconButton>
    </nav>

    <Dialog v-model:visible="showDialog" header="Phase 3 verification">
      <p class="text-muted text-sm">
        This dialog is rendered through the
        <code class="bg-surface-sunken rounded px-1 py-0.5 text-xs">ui/Dialog.vue</code>
        wrapper around the PrimeVue Dialog in unstyled mode. All visual styling comes from Tailwind
        v4 utilities via the passthrough (<code
          class="bg-surface-sunken rounded px-1 py-0.5 text-xs"
          >pt</code
        >) API.
      </p>
      <p class="text-muted mt-3 text-sm">
        Toggle dark mode with the sun / moon button to verify the design tokens flip cleanly without
        flashing.
      </p>
      <template #footer>
        <Button variant="ghost" @click="showDialog = false">Cancel</Button>
        <Button variant="primary" @click="showDialog = false">Got it</Button>
      </template>
    </Dialog>
  </main>
</template>
