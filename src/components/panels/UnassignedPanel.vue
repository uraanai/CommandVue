<script setup lang="ts">
import type { PanelType } from "@/types/workspace";
import type { DockviewApi, DockviewPanelApi } from "dockview-vue";

import { Square } from "@lucide/vue";
import { computed, ref } from "vue";

import Button from "@/components/ui/Button.vue";
import { panelRegistry } from "@/modules/panels/registry";
import { UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
import { useLayoutStore } from "@/stores/layout";
import { usePanelStateStore } from "@/stores/panelState";
import { useSessionStore } from "@/stores/session";

/**
 * UnassignedPanel — rendered for any panel-state with `assignmentState: 'empty'`.
 *
 * The panel-state record already exists (created via the View → Add Empty
 * Panel flow or by `seedIfEmpty`). The user picks a component type from the
 * registry; we patch the panel-state record (panelType + assignmentState),
 * then swap the live Dockview panel for one of the new type. Dockview has no
 * `setComponent` API, so the swap is: add a new panel into the same group,
 * then remove this one. Same panel id preserves cross-references in the
 * Layout's `panelIds` and in any preset's `appliedPresetIds`.
 */
interface Props {
  api: DockviewPanelApi;
  containerApi: DockviewApi;
}

const props = defineProps<Props>();

const panelStateStore = usePanelStateStore();
const session = useSessionStore();
const _layoutStore = useLayoutStore();
void _layoutStore;

const selectedType = ref<PanelType>("");
const switching = ref(false);

const candidates = computed(() =>
  panelRegistry
    .list()
    .filter((d) => d.id !== UNASSIGNED_PANEL_TYPE && d.id !== "components-browser")
    .sort((a, b) => a.title.localeCompare(b.title)),
);

async function assign(): Promise<void> {
  if (!selectedType.value) return;
  const targetType = selectedType.value;
  const definition = panelRegistry.get(targetType);
  if (!definition) return;

  switching.value = true;
  try {
    const panelId = props.api.id;
    await panelStateStore.assignComponent(panelId, targetType, "configured");

    const group = props.api.group;
    props.containerApi.addPanel({
      id: panelId,
      component: targetType,
      title: definition.title,
      position: { referenceGroup: group, direction: "within" },
    });
    props.api.close();
    session.markDirty();
  } finally {
    switching.value = false;
  }
}
</script>

<template>
  <div class="bg-surface text-foreground flex h-full w-full items-center justify-center p-6">
    <div class="flex w-full max-w-sm flex-col items-center gap-4">
      <Square class="text-faint size-10" />
      <p class="text-muted text-sm">This panel is empty</p>
      <div class="flex w-full flex-col gap-2">
        <label class="text-faint text-[10px] tracking-[0.18em] uppercase">
          Assign a component
        </label>
        <select
          v-model="selectedType"
          class="border-border bg-surface-raised text-foreground focus-visible:ring-accent-500 block w-full rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          :disabled="switching"
        >
          <option value="" disabled>Choose a panel type…</option>
          <option v-for="def in candidates" :key="def.id" :value="def.id">
            {{ def.title }}
          </option>
        </select>
        <Button variant="primary" size="sm" :disabled="!selectedType || switching" @click="assign">
          {{ switching ? "Assigning…" : "Assign" }}
        </Button>
        <label class="text-faint text-[10px] tracking-[0.18em] uppercase"> Apply preset </label>
        <select
          class="border-border bg-surface-raised text-muted focus-visible:ring-accent-500 block w-full rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          disabled
        >
          <option>No presets available</option>
        </select>
      </div>
    </div>
  </div>
</template>
