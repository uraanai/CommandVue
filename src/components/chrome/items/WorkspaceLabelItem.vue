<script setup lang="ts">
import { Layers } from "@lucide/vue";

import { useWorkspaceStore } from "@/stores/workspace";

const workspace = useWorkspaceStore();
</script>

<template>
  <span class="text-muted flex items-center gap-1 text-xs">
    <Layers class="size-3" />
    <span class="text-foreground font-medium">{{ workspace.currentWorkspace?.name ?? "—" }}</span>
  </span>
</template>
