<script setup lang="ts">
import type { DataTableDensity } from "@/components/ui/datatable/types";

import { computed, ref } from "vue";

import DataTable from "@/components/ui/DataTable.vue";
import { createColumnHelper } from "@/components/ui/datatable/columnHelpers";
import Input from "@/components/ui/Input.vue";
import Select from "@/components/ui/Select.vue";

/**
 * Reference page for `<DataTable>`. Renders 1,000 mock rows so virtualization
 * actually kicks in and the demo exercises every public feature: sorting,
 * filtering, column visibility, column resize, density modes, sticky header,
 * sticky first column, row click.
 *
 * Only registered when `import.meta.env.DEV === true` — never shipped in
 * production builds.
 */

interface DemoEntity {
  id: string;
  callsign: string;
  type: "air" | "ground" | "naval";
  status: "active" | "standby" | "offline";
  altitude: number;
  speed: number;
  lastSeen: number;
}

const TYPES: DemoEntity["type"][] = ["air", "ground", "naval"];
const STATUSES: DemoEntity["status"][] = ["active", "standby", "offline"];

function generateRows(count: number): DemoEntity[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ENT-${String(i + 1).padStart(5, "0")}`,
    callsign: `Unit-${(i + 1).toString(36).toUpperCase()}`,
    type: TYPES[i % TYPES.length]!,
    status: STATUSES[(i * 3) % STATUSES.length]!,
    altitude: Math.floor(Math.random() * 12000),
    speed: Math.floor(Math.random() * 600),
    lastSeen: Date.now() - i * 1000 * 30,
  }));
}

const rows = ref<DemoEntity[]>(generateRows(1000));

const helper = createColumnHelper<DemoEntity>();

const columns = computed(() => [
  helper.accessor("id", { header: "ID", size: 110 }),
  helper.accessor("callsign", { header: "Callsign", size: 160, enableSorting: true }),
  helper.accessor("type", { header: "Type", size: 100 }),
  helper.accessor("status", { header: "Status", size: 110 }),
  helper.accessor("altitude", { header: "Alt (m)", size: 110 }),
  helper.accessor("speed", { header: "Speed (kn)", size: 120 }),
  helper.accessor("lastSeen", {
    header: "Last seen",
    size: 180,
    cell: (info) => new Date(info.getValue() as number).toLocaleTimeString(),
  }),
]);

const density = ref<DataTableDensity>("comfortable");
const densityOptions: { label: string; value: DataTableDensity }[] = [
  { label: "Compact", value: "compact" },
  { label: "Comfortable", value: "comfortable" },
  { label: "Spacious", value: "spacious" },
];

function onDensityChange(value: null | number | string): void {
  if (value === "compact" || value === "comfortable" || value === "spacious") {
    density.value = value;
  }
}

const globalFilter = ref("");
const lastClicked = ref<DemoEntity | null>(null);

function onRowClick(row: DemoEntity): void {
  lastClicked.value = row;
}
</script>

<template>
  <main class="bg-surface-sunken text-foreground flex h-screen flex-col">
    <header class="border-border bg-surface-raised border-b px-4 py-3">
      <h1 class="text-base font-semibold">DataTable demo</h1>
      <p class="text-muted text-xs">
        1,000 mock rows · auto-virtualized · sticky header + first column · all densities
      </p>
    </header>

    <section class="flex-1 overflow-hidden p-4">
      <div class="bg-surface border-border h-full overflow-hidden rounded border">
        <DataTable
          :data="rows"
          :columns="columns"
          row-key="id"
          :density="density"
          :sticky-header="true"
          :sticky-first-column="true"
          :global-filter="globalFilter"
          @row-click="onRowClick"
        >
          <template #toolbar>
            <div class="flex w-full flex-wrap items-center gap-3">
              <Input v-model="globalFilter" placeholder="Filter rows…" class="w-48" />
              <Select
                :model-value="density"
                :options="densityOptions"
                class="w-40"
                @update:model-value="onDensityChange"
              />
              <span v-if="lastClicked" class="text-muted text-xs">
                Last click: <span class="text-foreground font-mono">{{ lastClicked.id }}</span>
              </span>
              <span class="text-muted ml-auto text-xs"> {{ rows.length }} rows </span>
            </div>
          </template>
        </DataTable>
      </div>
    </section>
  </main>
</template>
