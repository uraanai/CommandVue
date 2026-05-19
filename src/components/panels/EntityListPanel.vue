<script setup lang="ts">
import {
  createColumnHelper,
  FlexRender,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
  type SortingState,
} from "@tanstack/vue-table";
import { computed, ref } from "vue";

import { renderSidcToSvg } from "@/modules/symbology/render";
import { useEntitiesStore, type Entity } from "@/stores/entities";
import { formatLatLon } from "@/utils/format";

const entities = useEntitiesStore();
const data = computed(() => entities.entities);

const helper = createColumnHelper<Entity>();
const columns = [
  helper.display({
    id: "symbol",
    header: "",
    cell: ({ row }) => row.original,
  }),
  helper.accessor("name", { header: "Callsign" }),
  helper.accessor("affiliation", { header: "Affiliation" }),
  helper.accessor((row) => formatLatLon(row.position.lat, row.position.lon, 2), {
    id: "position",
    header: "Position",
  }),
  helper.accessor("altitudeMeters", {
    header: "Alt (m)",
    cell: ({ getValue }) => getValue() ?? "—",
  }),
  helper.accessor("speedKnots", {
    header: "Speed (kn)",
    cell: ({ getValue }) => getValue()?.toFixed(1) ?? "—",
  }),
  helper.accessor("headingDegrees", {
    header: "Heading",
    cell: ({ getValue }) => `${getValue() ?? "—"}°`,
  }),
];

const sorting = ref<SortingState>([{ id: "name", desc: false }]);

const table = useVueTable({
  get data() {
    return data.value;
  },
  columns,
  state: {
    get sorting() {
      return sorting.value;
    },
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === "function" ? updater(sorting.value) : updater;
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
});

function symbolSvg(entity: Entity): string {
  return renderSidcToSvg(entity.sidc, { size: 22 });
}

const affiliationClass: Record<Entity["affiliation"], string> = {
  friend: "text-blue-400",
  hostile: "text-red-400",
  neutral: "text-emerald-400",
  unknown: "text-yellow-400",
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
      <table class="text-foreground w-full text-xs">
        <thead class="bg-surface-raised text-muted sticky top-0 z-10">
          <tr v-for="hg in table.getHeaderGroups()" :key="hg.id">
            <th
              v-for="header in hg.headers"
              :key="header.id"
              class="border-border cursor-pointer border-b px-2 py-1.5 text-left font-medium select-none"
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
              <span v-if="header.column.getIsSorted() === 'asc'" class="ml-1">↑</span>
              <span v-else-if="header.column.getIsSorted() === 'desc'" class="ml-1">↓</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            class="hover:bg-surface-raised border-border border-b"
          >
            <td class="px-2 py-1">
              <!-- eslint-disable-next-line vue/no-v-html -- milsymbol returns sanitized SVG -->
              <span class="flex h-5 items-center" v-html="symbolSvg(row.original)" />
            </td>
            <td class="px-2 py-1 font-medium">{{ row.original.name }}</td>
            <td class="px-2 py-1" :class="affiliationClass[row.original.affiliation]">
              {{ row.original.affiliation }}
            </td>
            <td class="px-2 py-1 font-mono">
              {{ formatLatLon(row.original.position.lat, row.original.position.lon, 2) }}
            </td>
            <td class="px-2 py-1 font-mono">{{ row.original.altitudeMeters ?? "—" }}</td>
            <td class="px-2 py-1 font-mono">{{ row.original.speedKnots?.toFixed(1) ?? "—" }}</td>
            <td class="px-2 py-1 font-mono">{{ row.original.headingDegrees }}°</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
