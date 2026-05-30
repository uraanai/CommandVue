<script setup lang="ts">
import type { PanelApiProps } from "@/composables/usePanelApi";
import type { PanelCategory, PanelDefinition } from "@/modules/panels/types";

import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue";

import Input from "@/components/ui/Input.vue";
import { usePanelApi } from "@/composables/usePanelApi";
import { panelRegistry } from "@/modules/panels/registry";
import { UNASSIGNED_PANEL_TYPE } from "@/modules/panels/unassigned";
import { newId } from "@/modules/storage/ids";
import { useLayoutStore } from "@/stores/layout";
import { usePanelStateStore } from "@/stores/panelState";
import { useSessionStore } from "@/stores/session";
import DataView from "@/volt/DataView.vue";

/**
 * ComponentsPanel — the singleton "browser" view of every registered panel
 * type. Click a tile to spawn a new floating panel of that type. The panel
 * subscribes to the registry so newly-registered types appear without a
 * remount.
 *
 * Tile grid is rendered via Volt `DataView` (`layout="grid"`) per ADR 0002
 * Option C — PrimeVue ships the right component for "category-grouped item
 * grids" so library-first applies. One DataView per category gives us the
 * grouped layout `DataView` doesn't natively support.
 */
const props = defineProps<PanelApiProps>();

// dockview-vue passes the container api inside the `params` bag — see
// usePanelApi.
const { containerApi } = usePanelApi(props);

const layoutStore = useLayoutStore();
const panelStateStore = usePanelStateStore();
const session = useSessionStore();

const definitions = shallowRef<PanelDefinition[]>([]);
const filter = ref("");

let unsubscribe: (() => void) | null = null;
onMounted(() => {
  unsubscribe = panelRegistry.subscribe((all) => {
    definitions.value = all.filter(
      (d) => d.id !== UNASSIGNED_PANEL_TYPE && d.id !== "components-browser",
    );
  });
});
onUnmounted(() => {
  unsubscribe?.();
});

const grouped = computed(() => {
  const term = filter.value.trim().toLowerCase();
  const matched = term
    ? definitions.value.filter(
        (d) => d.title.toLowerCase().includes(term) || d.description.toLowerCase().includes(term),
      )
    : definitions.value;
  const groups: Partial<Record<PanelCategory, PanelDefinition[]>> = {};
  for (const def of matched) {
    const bucket = groups[def.category] ?? (groups[def.category] = []);
    bucket.push(def);
  }
  for (const list of Object.values(groups)) list?.sort((a, b) => a.title.localeCompare(b.title));
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)) as [
    PanelCategory,
    PanelDefinition[],
  ][];
});

async function addPanelOfType(def: PanelDefinition): Promise<void> {
  const layoutId = layoutStore.currentLayoutId;
  if (!layoutId) return;
  // Dockview wires `containerApi` through to panels via the `params` bag, but
  // the session store keeps a singleton `DockviewApi` reference the menubar
  // also uses. Prefer the panel-scoped api (no extra coupling) and fall back
  // to the session-store API — both address the same Dockview instance.
  const api = containerApi.value ?? session.getDockviewApi();
  if (!api) return;
  const panelId = newId();
  await panelStateStore.createPanel({
    layoutId,
    panelType: def.id,
    assignmentState: "configured",
    id: panelId,
  });
  api.addPanel({
    id: panelId,
    component: def.id,
    title: def.title,
    floating: true,
  });
  session.markDirty();
}
</script>

<template>
  <div class="bg-surface flex h-full w-full flex-col">
    <div class="border-border flex items-center gap-2 border-b px-4 py-2">
      <Input v-model="filter" type="search" placeholder="Filter components…" class="w-full" />
    </div>
    <div class="flex-1 overflow-y-auto px-4 py-3">
      <div v-if="grouped.length === 0" class="text-muted py-8 text-center text-sm">
        No matching components
      </div>
      <section v-for="[category, items] in grouped" :key="category" class="mb-4">
        <h3 class="text-faint mb-2 text-[10px] tracking-[0.18em] uppercase">
          {{ category }}
        </h3>
        <DataView
          :value="items"
          layout="grid"
          :pt="{
            root: { class: 'border-0' },
            content: { class: 'bg-transparent' },
          }"
        >
          <template #grid="{ items: rowItems }: { items: PanelDefinition[] }">
            <div class="grid grid-cols-2 gap-2">
              <!-- eslint-disable-next-line vue/no-restricted-html-elements -- Card-style grid tile (two-line, left-aligned, fills the cell); PrimeVue Button can't express this layout. Documented escape valve, see docs/contributing-ui.md. -->
              <button
                v-for="def in rowItems"
                :key="def.id"
                type="button"
                class="border-border bg-surface-raised hover:bg-surface-sunken focus-visible:ring-accent-500 flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left text-xs focus-visible:ring-2 focus-visible:outline-none"
                :title="def.description"
                @click="addPanelOfType(def)"
              >
                <span class="text-foreground font-medium">{{ def.title }}</span>
                <span class="text-faint line-clamp-2 text-[10px]">{{ def.description }}</span>
              </button>
            </div>
          </template>
        </DataView>
      </section>
    </div>
  </div>
</template>
