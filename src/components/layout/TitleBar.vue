<script setup lang="ts">
import { Moon, RotateCcw, Sun } from "@lucide/vue";
import { inject } from "vue";
import { RouterLink } from "vue-router";

import IconButton from "@/components/ui/IconButton.vue";
import { useTheme } from "@/composables/useTheme";

import { resetLayoutKey } from "./keys";

const { isDark, toggle } = useTheme();
const resetLayout = inject(resetLayoutKey, null);
</script>

<template>
  <header
    class="border-border bg-surface-raised flex h-[var(--spacing-titlebar)] items-center gap-4 border-b px-4"
  >
    <div class="flex items-center gap-2">
      <span class="text-foreground text-sm font-semibold tracking-tight">CommandVue</span>
      <span class="text-faint text-[10px] tracking-[0.2em] uppercase">Operations</span>
    </div>

    <nav class="flex items-center gap-1 text-xs">
      <RouterLink
        to="/"
        active-class="text-foreground bg-surface-sunken"
        class="text-muted hover:text-foreground hover:bg-surface-sunken rounded px-2 py-1 transition-colors"
      >
        Dock
      </RouterLink>
      <RouterLink
        to="/demo"
        active-class="text-foreground bg-surface-sunken"
        class="text-muted hover:text-foreground hover:bg-surface-sunken rounded px-2 py-1 transition-colors"
      >
        Demo
      </RouterLink>
      <RouterLink
        to="/about"
        active-class="text-foreground bg-surface-sunken"
        class="text-muted hover:text-foreground hover:bg-surface-sunken rounded px-2 py-1 transition-colors"
      >
        About
      </RouterLink>
    </nav>

    <div class="ml-auto flex items-center gap-1">
      <IconButton
        v-if="resetLayout"
        label="Reset dock layout"
        variant="ghost"
        size="sm"
        @click="resetLayout()"
      >
        <RotateCcw />
      </IconButton>
      <IconButton
        :label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        variant="ghost"
        size="sm"
        @click="toggle()"
      >
        <Sun v-if="isDark" />
        <Moon v-else />
      </IconButton>
    </div>
  </header>
</template>
