<script setup lang="ts">
import { LayoutPanelLeft } from "@lucide/vue";

import { useLayoutStore } from "@/stores/layout";

const layoutStore = useLayoutStore();
</script>

<template>
  <span class="text-muted flex items-center gap-1 text-xs">
    <LayoutPanelLeft class="size-3" />
    <span class="text-foreground font-medium">{{ layoutStore.currentLayout?.name ?? "—" }}</span>
  </span>
</template>
