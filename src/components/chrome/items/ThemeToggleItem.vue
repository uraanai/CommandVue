<script setup lang="ts">
import { Monitor, Moon, Sun } from "@lucide/vue";
import { computed } from "vue";

import IconButton from "@/components/ui/IconButton.vue";
import { useTheme } from "@/composables/useTheme";

/**
 * ThemeToggleItem — chrome item that cycles between Light, Dark, and Auto.
 *
 * Cycle order: light → dark → auto → light. The icon reflects the *current*
 * mode (Sun / Moon / Monitor). The aria-label and title describe the *next*
 * mode so click discoverability is clear.
 *
 * Mode change announcements happen inside `setMode` via a visually-hidden
 * polite aria-live region (set up lazily by `useTheme`).
 */
const { mode, nextModeLabel, cycleMode } = useTheme();

const iconLabel = computed(() => {
  switch (mode.value) {
    case "light":
      return "Light mode";
    case "dark":
      return "Dark mode";
    case "auto":
      return "Auto mode (system)";
  }
  return "Theme";
});

const tooltip = computed(() => `${iconLabel.value} — click for ${nextModeLabel.value}`);
</script>

<template>
  <IconButton :label="tooltip" :title="tooltip" variant="ghost" size="sm" @click="cycleMode()">
    <Sun v-if="mode === 'light'" class="size-3.5" />
    <Moon v-else-if="mode === 'dark'" class="size-3.5" />
    <Monitor v-else class="size-3.5" />
  </IconButton>
</template>
