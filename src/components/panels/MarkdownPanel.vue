<script setup lang="ts">
import { FileText } from "@lucide/vue";
</script>

<template>
  <div
    class="bg-surface-sunken flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
  >
    <FileText class="text-accent-500 size-10" />
    <h3 class="text-foreground text-sm font-medium">Markdown briefing</h3>
    <p class="text-muted text-xs">Wires up in Phase 6 (markdown-it + @tailwindcss/typography).</p>
  </div>
</template>
