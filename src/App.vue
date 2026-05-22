<script setup lang="ts">
import { onMounted } from "vue";

import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import AppShell from "@/components/layout/AppShell.vue";
import { useLayoutStore } from "@/stores/layout";
import { useWorkspaceStore } from "@/stores/workspace";

// Boot order: load the workspace pointer, then the layouts for that
// workspace. DockLayout will pick up `currentLayoutId` on mount via the
// session store. We render a loading splash while these IDB reads resolve
// (~tens of ms on first boot) so no view renders against empty stores.
const workspace = useWorkspaceStore();
const layout = useLayoutStore();

onMounted(async () => {
  await workspace.loadAll();
  if (workspace.currentWorkspaceId) {
    await layout.loadForWorkspace(workspace.currentWorkspaceId);
  }
});
</script>

<template>
  <AppShell v-if="workspace.ready" />
  <div v-else class="bg-surface flex h-screen items-center justify-center">
    <LoadingSpinner />
  </div>
</template>
