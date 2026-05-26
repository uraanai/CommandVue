<script setup lang="ts">
import type { PanelApiProps } from "@/composables/usePanelApi";
import type { PanelType } from "@/types/workspace";

import { AlertTriangle } from "@lucide/vue";
import { computed, ref } from "vue";

import Button from "@/components/ui/Button.vue";
import Select from "@/components/ui/Select.vue";
import { usePanelApi } from "@/composables/usePanelApi";
import { panelRegistry } from "@/modules/panels/registry";
import { swapPanelComponent } from "@/modules/panels/swap";
import { UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
import { usePanelStateStore } from "@/stores/panelState";
import { useSessionStore } from "@/stores/session";

/**
 * MissingPanelPlaceholder — rendered when a panel-state record references a
 * `panelType` that is no longer registered (e.g. the downstream app removed
 * that panel type, or an imported workspace references a custom panel the
 * importer doesn't know about).
 *
 * The user has two options:
 *  1. **Remove panel** — clears the panel-state record entirely.
 *  2. **Reassign to** — pick a different registered panel type. The panel-id
 *     stays the same so cross-references (`layout.panelIds`,
 *     `panel.appliedPresetIds`) survive intact.
 */
const props = defineProps<PanelApiProps>();

// dockview-vue passes api + containerApi inside `params`, not as top-level
// props — see usePanelApi.
const { api, containerApi } = usePanelApi(props);

const panelStateStore = usePanelStateStore();
const session = useSessionStore();

const selectedType = ref<null | PanelType>(null);
const busy = ref(false);

const missingType = computed(() => {
  const id = api.value?.id;
  return id ? (panelStateStore.getState(id)?.panelType ?? "unknown") : "unknown";
});

const candidates = computed(() =>
  panelRegistry
    .list()
    .filter((d) => d.id !== UNASSIGNED_PANEL_TYPE && d.id !== "components-browser")
    .sort((a, b) => a.title.localeCompare(b.title)),
);

const candidateOptions = computed(() =>
  candidates.value.map((d) => ({ label: d.title, value: d.id })),
);

async function reassign(): Promise<void> {
  if (!selectedType.value) return;
  const panelApi = api.value;
  const dockApi = containerApi.value;
  if (!panelApi || !dockApi) return;
  const target = selectedType.value;
  const def = panelRegistry.get(target);
  if (!def) return;
  busy.value = true;
  try {
    const panelId = panelApi.id;
    await panelStateStore.assignComponent(panelId, target, "configured");
    // Swap the placeholder for the chosen type, preserving the panel id so
    // cross-references survive.
    swapPanelComponent(dockApi, panelApi, { component: target, title: def.title });
    session.markDirty();
  } finally {
    busy.value = false;
  }
}

async function removePanel(): Promise<void> {
  const panelApi = api.value;
  if (!panelApi) return;
  busy.value = true;
  try {
    const panelId = panelApi.id;
    await panelStateStore.deletePanel(panelId);
    panelApi.close();
    session.markDirty();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="bg-surface text-foreground flex h-full w-full items-center justify-center p-6">
    <div class="flex w-full max-w-sm flex-col items-center gap-4">
      <AlertTriangle class="text-warning size-10" />
      <p class="text-foreground text-sm font-medium">Panel type is no longer available</p>
      <p class="text-faint text-center text-xs">
        The component <span class="text-muted font-mono">{{ missingType }}</span> isn't registered
        in this build. Reassign the panel to a different type or remove it.
      </p>
      <div class="flex w-full flex-col gap-2">
        <label class="text-faint text-[10px] tracking-[0.18em] uppercase">Reassign to</label>
        <Select
          v-model="selectedType"
          :options="candidateOptions"
          placeholder="Choose a panel type…"
          :disabled="busy"
        />
        <Button variant="primary" size="sm" :disabled="!selectedType || busy" @click="reassign">
          Reassign
        </Button>
        <Button variant="ghost" size="sm" :disabled="busy" @click="removePanel">
          Remove panel
        </Button>
      </div>
    </div>
  </div>
</template>
