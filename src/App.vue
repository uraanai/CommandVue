<script setup lang="ts">
import { onMounted } from "vue";

import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import AppShell from "@/components/layout/AppShell.vue";
import { useLayoutStore } from "@/stores/layout";
import { usePresetStore } from "@/stores/preset";
import { useThemeStore } from "@/stores/theme";
import { useWorkspaceStore } from "@/stores/workspace";

// Boot order:
//   1. workspace pointer (which workspace are we in?)
//   2. theme — resolve workspace-bound vs global, apply tokens to :root
//   3. layouts + presets for the active workspace
//
// Theme must apply BEFORE the dock + panels render so they don't flash
// the pre-theme defaults. The anti-FOUC inline script in index.html already
// painted a paint-safe data-theme; this call layers the chosen variant on
// top.
const workspace = useWorkspaceStore();
const layout = useLayoutStore();
const presets = usePresetStore();
const theme = useThemeStore();

onMounted(async () => {
  await workspace.loadAll();
  await theme.loadInitial(workspace.currentWorkspaceId);
  if (workspace.currentWorkspaceId) {
    await layout.loadForWorkspace(workspace.currentWorkspaceId);
    await presets.loadForWorkspace(workspace.currentWorkspaceId);
  }
});
</script>

<template>
  <AppShell v-if="workspace.ready" />
  <div v-else class="bg-surface flex h-screen items-center justify-center">
    <LoadingSpinner />
  </div>
</template>
