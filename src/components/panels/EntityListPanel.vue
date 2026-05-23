<script setup lang="ts">
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import { computed } from "vue";

import { renderSidcToSvg } from "@/modules/symbology/render";
import { useEntitiesStore, type Entity } from "@/stores/entities";
import { cn } from "@/utils/cn";
import { formatLatLon } from "@/utils/format";

/**
 * EntityListPanel — sortable list of tracked entities.
 *
 * Backed by PrimeVue `DataTable` (sortable columns, sticky headers).
 * Replaced the previous `@tanstack/vue-table` implementation during the
 * PrimeVue-first audit — DataTable covers the project's table needs natively
 * and matches the styling already used in the management dialogs.
 */
const entities = useEntitiesStore();
const data = computed(() => entities.entities);

const affiliationClass: Record<Entity["affiliation"], string> = {
  friend: "text-blue-400",
  hostile: "text-red-400",
  neutral: "text-emerald-400",
  unknown: "text-yellow-400",
};

function symbolSvg(entity: Entity): string {
  return renderSidcToSvg(entity.sidc, { size: 22 });
}

const tablePT = {
  root: { class: "h-full" },
  tableContainer: { class: "h-full" },
  table: { class: "text-foreground w-full text-xs" },
  thead: { class: "bg-surface-raised text-muted sticky top-0 z-10" },
  headerRow: { class: "border-border border-b" },
  headerCell: { class: "px-2 py-1.5 text-left font-medium select-none cursor-pointer" },
  bodyRow: { class: "hover:bg-surface-raised border-border border-b" },
  bodyCell: { class: "px-2 py-1" },
  sortIcon: { class: "ml-1 inline-flex" },
};
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

    <div class="min-h-0 flex-1 overflow-auto">
      <DataTable
        :value="data"
        data-key="id"
        sort-field="name"
        :sort-order="1"
        size="small"
        :pt="tablePT"
      >
        <Column header="" header-style="width: 2rem">
          <template #body="{ data: row }">
            <!-- eslint-disable-next-line vue/no-v-html -- milsymbol returns sanitized SVG -->
            <span class="flex h-5 items-center" v-html="symbolSvg(row)" />
          </template>
        </Column>
        <Column field="name" header="Callsign" sortable>
          <template #body="{ data: row }">
            <span class="font-medium">{{ row.name }}</span>
          </template>
        </Column>
        <Column field="affiliation" header="Affiliation" sortable>
          <template #body="{ data: row }">
            <span :class="cn(affiliationClass[row.affiliation as Entity['affiliation']])">
              {{ row.affiliation }}
            </span>
          </template>
        </Column>
        <Column header="Position">
          <template #body="{ data: row }">
            <span class="font-mono">
              {{ formatLatLon(row.position.lat, row.position.lon, 2) }}
            </span>
          </template>
        </Column>
        <Column field="altitudeMeters" header="Alt (m)" sortable>
          <template #body="{ data: row }">
            <span class="font-mono">{{ row.altitudeMeters ?? "—" }}</span>
          </template>
        </Column>
        <Column field="speedKnots" header="Speed (kn)" sortable>
          <template #body="{ data: row }">
            <span class="font-mono">{{ row.speedKnots?.toFixed(1) ?? "—" }}</span>
          </template>
        </Column>
        <Column field="headingDegrees" header="Heading" sortable>
          <template #body="{ data: row }">
            <span class="font-mono">{{ row.headingDegrees ?? "—" }}°</span>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
