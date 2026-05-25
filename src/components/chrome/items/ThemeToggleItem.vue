<script setup lang="ts">
import { Moon, Sun } from "@lucide/vue";

import IconButton from "@/components/ui/IconButton.vue";
import { useTheme } from "@/composables/useTheme";

/**
 * ThemeToggleItem — chrome item that flips between light and dark theme.
 *
 * Wraps the project's `useTheme` composable. The two-mode toggle here is the
 * existing behavior; Prompt 3 will replace this with a three-way Light / Dark
 * / Auto control alongside the design-token foundation work.
 */
const { isDark, toggle } = useTheme();
</script>

<template>
  <IconButton
    :label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    variant="ghost"
    size="sm"
    @click="toggle()"
  >
    <Sun v-if="isDark" class="size-3.5" />
    <Moon v-else class="size-3.5" />
  </IconButton>
</template>
