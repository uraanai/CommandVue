<script setup lang="ts">
import { RouterView } from "vue-router";

import { useTheme } from "@/composables/useTheme";

import StatusBar from "./StatusBar.vue";
import TitleBar from "./TitleBar.vue";

// Bootstraps the theme composable so `data-theme` is on <html> from first paint.
useTheme();
</script>

<template>
  <div class="bg-surface text-foreground flex h-screen w-screen flex-col overflow-hidden">
    <TitleBar />
    <main class="min-h-0 flex-1">
      <RouterView />
    </main>
    <StatusBar />
  </div>
</template>
