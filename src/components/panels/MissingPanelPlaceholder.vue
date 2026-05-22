<script setup lang="ts">
import type { PanelType } from "@/types/workspace";
import type { DockviewApi, DockviewPanelApi } from "dockview-vue";

import { AlertTriangle } from "@lucide/vue";
import { computed, ref } from "vue";

import Button from "@/components/ui/Button.vue";
import { panelRegistry } from "@/modules/panels/registry";
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
interface Props {
  api: DockviewPanelApi;
  containerApi: DockviewApi;
}

const props = defineProps<Props>();

const panelStateStore = usePanelStateStore();
const session = useSessionStore();

const selectedType = ref<PanelType>("");
const busy = ref(false);

const missingType = computed(() => panelStateStore.getState(props.api.id)?.panelType ?? "unknown");

const candidates = computed(() =>
  panelRegistry
    .list()
    .filter((d) => d.id !== UNASSIGNED_PANEL_TYPE && d.id !== "components-browser")
    .sort((a, b) => a.title.localeCompare(b.title)),
);

async function reassign(): Promise<void> {
  if (!selectedType.value) return;
  const target = selectedType.value;
  const def = panelRegistry.get(target);
  if (!def) return;
  busy.value = true;
  try {
    const panelId = props.api.id;
    await panelStateStore.assignComponent(panelId, target, "configured");
    const group = props.api.group;
    props.containerApi.addPanel({
      id: panelId,
      component: target,
      title: def.title,
      position: { referenceGroup: group, direction: "within" },
    });
    props.api.close();
    session.markDirty();
  } finally {
    busy.value = false;
  }
}

async function removePanel(): Promise<void> {
  busy.value = true;
  try {
    const panelId = props.api.id;
    await panelStateStore.deletePanel(panelId);
    props.api.close();
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
        <select
          v-model="selectedType"
          class="border-border bg-surface-raised text-foreground focus-visible:ring-accent-500 block w-full rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          :disabled="busy"
        >
          <option value="" disabled>Choose a panel type…</option>
          <option v-for="def in candidates" :key="def.id" :value="def.id">
            {{ def.title }}
          </option>
        </select>
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
