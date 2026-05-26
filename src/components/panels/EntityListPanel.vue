<script setup lang="ts">
import type {
  DataTableDensity,
  SortingState,
  VisibilityState,
} from "@/components/ui/datatable/types";
import type { PanelApiProps } from "@/composables/usePanelApi";

import { computed, ref } from "vue";

import DataTable from "@/components/ui/DataTable.vue";
import { createColumnHelper } from "@/components/ui/datatable/columnHelpers";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";
import { usePanelApi } from "@/composables/usePanelApi";
import { usePanelState } from "@/composables/usePanelState";
import { renderSidcToSvg } from "@/modules/symbology/render";
import { useEntitiesStore, type Entity } from "@/stores/entities";
import { cn } from "@/utils/cn";
import { formatLatLon } from "@/utils/format";

/**
 * EntityListPanel — sortable, filterable list of tracked entities.
 *
 * Built on the project's `<DataTable>` wrapper (TanStack Vue Table + Vue
 * Virtual) per the ADR at `docs/decisions/0001-datatable-library.md`. Panel
 * state — sort, global filter text, column visibility, density — persists
 * across workspace reloads via `usePanelState`.
 */

interface EntityListPanelState extends Record<string, unknown> {
  sorting: SortingState;
  filterText: string;
  visibility: VisibilityState;
  density: DataTableDensity;
}

const props = defineProps<PanelApiProps>();

// dockview-vue passes the panel api inside the `params` bag — see usePanelApi.
const { api } = usePanelApi(props);

const entities = useEntitiesStore();
const data = computed(() => entities.entities);

const sorting = ref<SortingState>([{ id: "name", desc: false }]);
const filterText = ref<string>("");
const visibility = ref<VisibilityState>({});
const density = ref<DataTableDensity>("compact");

const densityOptions: { label: string; value: DataTableDensity }[] = [
  { label: "Compact", value: "compact" },
  { label: "Comfortable", value: "comfortable" },
  { label: "Spacious", value: "spacious" },
];

const affiliationClass: Record<Entity["affiliation"], string> = {
  friend: "text-blue-400",
  hostile: "text-red-400",
  neutral: "text-emerald-400",
  unknown: "text-yellow-400",
};

function symbolSvg(entity: Entity): string {
  return renderSidcToSvg(entity.sidc, { size: 22 });
}

const helper = createColumnHelper<Entity>();

const columns = computed(() => [
  helper.display({
    id: "symbol",
    header: "",
    size: 36,
    enableSorting: false,
    enableHiding: false,
  }),
  helper.accessor("name", { id: "name", header: "Callsign", size: 160 }),
  helper.accessor("affiliation", { id: "affiliation", header: "Affiliation", size: 120 }),
  helper.display({ id: "position", header: "Position", size: 160, enableSorting: false }),
  helper.accessor("altitudeMeters", { id: "altitudeMeters", header: "Alt (m)", size: 100 }),
  helper.accessor("speedKnots", { id: "speedKnots", header: "Speed (kn)", size: 110 }),
  helper.accessor("headingDegrees", { id: "headingDegrees", header: "Heading", size: 110 }),
]);

const persisted = api.value
  ? usePanelState<EntityListPanelState>(api.value.id, {
      serialize: () => ({
        sorting: sorting.value,
        filterText: filterText.value,
        visibility: visibility.value,
        density: density.value,
      }),
      restore: (state) => {
        if (Array.isArray(state.sorting)) sorting.value = state.sorting;
        if (typeof state.filterText === "string") filterText.value = state.filterText;
        if (state.visibility && typeof state.visibility === "object") {
          visibility.value = state.visibility;
        }
        if (
          state.density === "compact" ||
          state.density === "comfortable" ||
          state.density === "spacious"
        ) {
          density.value = state.density;
        }
      },
    })
  : null;

function persistChange(): void {
  persisted?.save();
}

function onSortChange(next: SortingState): void {
  sorting.value = next;
  persistChange();
}
function onGlobalFilterChange(next: string): void {
  filterText.value = next;
  persistChange();
}
function onVisibilityChange(next: VisibilityState): void {
  visibility.value = next;
  persistChange();
}
function onDensityChange(value: null | number | string): void {
  if (value === "compact" || value === "comfortable" || value === "spacious") {
    density.value = value;
    persistChange();
  }
}
</script>

<template>
  <div class="bg-surface-sunken flex h-full w-full flex-col">
    <header
      class="border-border bg-surface-raised text-muted flex items-center gap-3 border-b px-3 py-2 text-xs"
    >
      <span>{{ entities.entities.length }} entities</span>
      <span class="text-faint">·</span>
      <span class="text-blue-400">friend: {{ entities.totalsByAffiliation.friend }}</span>
      <span class="text-red-400">hostile: {{ entities.totalsByAffiliation.hostile }}</span>
      <span class="text-emerald-400">neutral: {{ entities.totalsByAffiliation.neutral }}</span>
      <span class="text-yellow-400">unknown: {{ entities.totalsByAffiliation.unknown }}</span>
    </header>

    <div class="min-h-0 flex-1">
      <DataTable
        :data="data"
        :columns="columns"
        row-key="id"
        :density="density"
        :sticky-header="true"
        :sticky-first-column="true"
        :global-filter="filterText"
        @sort-change="onSortChange"
        @global-filter-change="onGlobalFilterChange"
        @column-visibility-change="onVisibilityChange"
      >
        <template #toolbar>
          <div class="flex w-full flex-wrap items-center gap-2">
            <Input v-model="filterText" placeholder="Filter entities…" class="w-48" />
            <Select
              :model-value="density"
              :options="densityOptions"
              class="w-36"
              @update:model-value="onDensityChange"
            />
          </div>
        </template>

        <template #cell-symbol="{ row }">
          <!-- eslint-disable-next-line vue/no-v-html -- milsymbol returns sanitized SVG -->
          <span class="flex h-5 items-center" v-html="symbolSvg(row as Entity)" />
        </template>

        <template #cell-name="{ row }">
          <span class="font-medium">{{ (row as Entity).name }}</span>
        </template>

        <template #cell-affiliation="{ row }">
          <span :class="cn(affiliationClass[(row as Entity).affiliation])">
            {{ (row as Entity).affiliation }}
          </span>
        </template>

        <template #cell-position="{ row }">
          <span class="font-mono">
            {{ formatLatLon((row as Entity).position.lat, (row as Entity).position.lon, 2) }}
          </span>
        </template>

        <template #cell-altitudeMeters="{ value }">
          <span class="font-mono">{{ value ?? "—" }}</span>
        </template>

        <template #cell-speedKnots="{ value }">
          <span class="font-mono">{{ typeof value === "number" ? value.toFixed(1) : "—" }}</span>
        </template>

        <template #cell-headingDegrees="{ value }">
          <span class="font-mono">{{ value ?? "—" }}°</span>
        </template>
      </DataTable>
    </div>
  </div>
</template>
