<script setup lang="ts">
import type { PanelApiProps } from "@/composables/usePanelApi";
import type { PanelType } from "@/types/workspace";

import { Square } from "@lucide/vue";
import { computed, ref } from "vue";

import Button from "@/components/ui/Button.vue";
import Select from "@/components/ui/Select.vue";
import { usePanelApi } from "@/composables/usePanelApi";
import { panelRegistry } from "@/modules/panels/registry";
import { swapPanelComponent } from "@/modules/panels/swap";
import { UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
import { useLayoutStore } from "@/stores/layout";
import { usePanelStateStore } from "@/stores/panelState";
import { usePresetStore } from "@/stores/preset";
import { useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";

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
const props = defineProps<PanelApiProps>();

// dockview-vue hands panels their api + containerApi inside the `params` bag,
// not as top-level props — see usePanelApi.
const { api, containerApi } = usePanelApi(props);

const panelStateStore = usePanelStateStore();
const session = useSessionStore();
const presetStore = usePresetStore();
const workspace = useWorkspaceStore();
const _layoutStore = useLayoutStore();
void _layoutStore;

const selectedType = ref<null | PanelType>(null);
const selectedPreset = ref<null | string>(null);
const switching = ref(false);

const candidates = computed(() =>
  panelRegistry
    .list()
    .filter((d) => d.id !== UNASSIGNED_PANEL_TYPE && d.id !== "components-browser")
    .sort((a, b) => a.title.localeCompare(b.title)),
);

const componentOptions = computed(() =>
  candidates.value.map((d) => ({ label: d.title, value: d.id })),
);

const availablePresets = computed(() => {
  if (!selectedType.value) return [];
  return presetStore.presetsForPanel(selectedType.value, workspace.currentWorkspaceId);
});

const presetOptions = computed(() =>
  availablePresets.value.map((p) => ({ label: p.name, value: p.id })),
);

async function assign(): Promise<void> {
  if (!selectedType.value) return;
  const panelApi = api.value;
  const dockApi = containerApi.value;
  if (!panelApi || !dockApi) return;
  const targetType = selectedType.value;
  const definition = panelRegistry.get(targetType);
  if (!definition) return;

  switching.value = true;
  try {
    const panelId = panelApi.id;
    await panelStateStore.assignComponent(panelId, targetType, "configured");
    if (selectedPreset.value) {
      await presetStore.applyToPanel(panelId, selectedPreset.value);
    }

    // Swap the empty placeholder for a panel of the chosen type, keeping the
    // same id so the panel-state record + preset binding stay wired.
    swapPanelComponent(dockApi, panelApi, { component: targetType, title: definition.title });
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
        <Select
          v-model="selectedType"
          :options="componentOptions"
          placeholder="Choose a panel type…"
          :disabled="switching"
        />
        <Button variant="primary" size="sm" :disabled="!selectedType || switching" @click="assign">
          {{ switching ? "Assigning…" : "Assign" }}
        </Button>
        <label class="text-faint text-[10px] tracking-[0.18em] uppercase">
          Apply preset (optional)
        </label>
        <Select
          v-model="selectedPreset"
          :options="presetOptions"
          :placeholder="
            availablePresets.length === 0 ? 'No presets available' : 'None — apply later'
          "
          :disabled="!selectedType || availablePresets.length === 0"
          show-clear
        />
      </div>
    </div>
  </div>
</template>
