<script setup lang="ts" generic="TData">
import type { DataTableProps } from "./datatable/types";

import {
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useVueTable,
  type ColumnFiltersState,
  type ColumnSizingState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/vue-table";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { computed, ref, shallowRef, watch } from "vue";

import { cn } from "@/utils/cn";

/**
 * `<DataTable>` — CommandVue's default tabular-data primitive.
 *
 * Built on `@tanstack/vue-table` (state) + `@tanstack/vue-virtual` (windowing).
 * Generic over `TData`. Headless layout: CSS-grid table with shared column
 * widths driven by TanStack's `getSize()`, so header and body cells line up
 * regardless of resize or visibility changes.
 *
 * See `docs/datatable.md` for the full reference and migration guide, and
 * `docs/decisions/0001-datatable-library.md` for why this exists.
 */

const props = withDefaults(defineProps<DataTableProps<TData>>(), {
  rowKey: undefined,
  density: "comfortable",
  enableSorting: true,
  enableColumnResize: true,
  enableColumnVisibility: true,
  enableFiltering: true,
  enableVirtualization: "auto",
  selectionMode: "none",
  stickyHeader: true,
  stickyFirstColumn: false,
  zebraStripes: false,
  emptyMessage: "No data available",
  loading: false,
  loadingMessage: "Loading…",
  estimatedRowHeight: 36,
  containerHeight: "100%",
  globalFilter: "",
});

const emit = defineEmits<{
  "row-click": [row: TData, event: MouseEvent];
  "row-dblclick": [row: TData, event: MouseEvent];
  "selection-change": [rows: TData[]];
  "sort-change": [sorting: SortingState];
  "column-visibility-change": [visibility: VisibilityState];
  "column-resize-change": [sizing: ColumnSizingState];
  "global-filter-change": [value: string];
}>();

const sorting = ref<SortingState>([]);
const columnFilters = ref<ColumnFiltersState>([]);
const columnVisibility = ref<VisibilityState>({});
const columnSizing = ref<ColumnSizingState>({});
const rowSelection = ref<RowSelectionState>({});
const internalGlobalFilter = ref<string>(props.globalFilter);

watch(
  () => props.globalFilter,
  (next) => {
    if (next !== internalGlobalFilter.value) internalGlobalFilter.value = next;
  },
);

watch(sorting, (next) => emit("sort-change", next), { deep: true });
watch(columnVisibility, (next) => emit("column-visibility-change", next), { deep: true });
watch(columnSizing, (next) => emit("column-resize-change", next), { deep: true });
watch(internalGlobalFilter, (next) => emit("global-filter-change", next));

function resolveRowId(row: TData, index: number): string {
  const key = props.rowKey;
  if (typeof key === "function") return key(row);
  if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
    const value = (row as Record<string, unknown>)[key as string];
    if (value !== undefined && value !== null) return String(value);
  }
  return String(index);
}

const table = useVueTable<TData>({
  get data() {
    return props.data;
  },
  get columns() {
    return props.columns;
  },
  state: {
    get sorting() {
      return sorting.value;
    },
    get columnFilters() {
      return columnFilters.value;
    },
    get columnVisibility() {
      return columnVisibility.value;
    },
    get columnSizing() {
      return columnSizing.value;
    },
    get rowSelection() {
      return rowSelection.value;
    },
    get globalFilter() {
      return internalGlobalFilter.value;
    },
  },
  enableSorting: computed(() => props.enableSorting).value,
  enableColumnResizing: computed(() => props.enableColumnResize).value,
  enableHiding: computed(() => props.enableColumnVisibility).value,
  enableFilters: computed(() => props.enableFiltering).value,
  enableGlobalFilter: computed(() => props.enableFiltering).value,
  enableRowSelection: computed(() => props.selectionMode !== "none").value,
  enableMultiRowSelection: computed(() => props.selectionMode === "multiple").value,
  columnResizeMode: "onChange",
  getRowId: (row, index) => resolveRowId(row, index),
  onSortingChange: (updater) => {
    sorting.value = typeof updater === "function" ? updater(sorting.value) : updater;
  },
  onColumnFiltersChange: (updater) => {
    columnFilters.value = typeof updater === "function" ? updater(columnFilters.value) : updater;
  },
  onColumnVisibilityChange: (updater) => {
    columnVisibility.value =
      typeof updater === "function" ? updater(columnVisibility.value) : updater;
  },
  onColumnSizingChange: (updater) => {
    columnSizing.value = typeof updater === "function" ? updater(columnSizing.value) : updater;
  },
  onRowSelectionChange: (updater) => {
    const next = typeof updater === "function" ? updater(rowSelection.value) : updater;
    rowSelection.value = next;
    const selected = Object.keys(next)
      .filter((key) => next[key])
      .map((key) => {
        const found = table.getRowModel().rowsById[key]?.original;
        return found as TData;
      })
      .filter((row): row is TData => row !== undefined);
    emit("selection-change", selected);
  },
  onGlobalFilterChange: (updater) => {
    internalGlobalFilter.value =
      typeof updater === "function" ? updater(internalGlobalFilter.value) : (updater as string);
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
});

defineExpose({ table });

const scrollContainer = shallowRef<HTMLDivElement | null>(null);

const rows = computed<Row<TData>[]>(() => table.getRowModel().rows);

const shouldVirtualize = computed(() => {
  if (props.enableVirtualization === "auto") return rows.value.length > 100;
  return props.enableVirtualization === true;
});

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => scrollContainer.value,
    estimateSize: () => props.estimatedRowHeight,
    overscan: 8,
    enabled: shouldVirtualize.value,
  })),
);

const virtualItems = computed(() => rowVirtualizer.value.getVirtualItems());
const totalSize = computed(() => rowVirtualizer.value.getTotalSize());

const totalWidth = computed(() => table.getTotalSize());

function headerCellWidth(size: number): string {
  return `${size}px`;
}

function onHeaderKeydown(
  event: KeyboardEvent,
  header: ReturnType<typeof table.getHeaderGroups>[number]["headers"][number],
): void {
  if (!props.enableSorting) return;
  if (!header.column.getCanSort()) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    header.column.toggleSorting();
  }
}

function ariaSortFor(direction: false | "asc" | "desc"): "none" | "ascending" | "descending" {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
}

function onRowClick(event: MouseEvent, row: Row<TData>): void {
  if (props.selectionMode !== "none") {
    if (props.selectionMode === "single") {
      table.setRowSelection({ [row.id]: true });
    } else {
      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      if (additive) {
        row.toggleSelected();
      } else {
        table.setRowSelection({ [row.id]: true });
      }
    }
  }
  emit("row-click", row.original, event);
}

function onRowDblClick(event: MouseEvent, row: Row<TData>): void {
  emit("row-dblclick", row.original, event);
}

const containerClass = computed(() =>
  cn(
    "commandvue-datatable",
    "relative flex flex-col text-foreground",
    "bg-surface text-[var(--cv-dt-font-size)]",
  ),
);

const tableStyle = computed(() => ({
  width: `${totalWidth.value}px`,
  minWidth: "100%",
}));
</script>

<template>
  <div
    :class="containerClass"
    :data-density="density"
    :data-loading="loading ? 'true' : 'false'"
    :style="{ height: containerHeight }"
    role="table"
    :aria-rowcount="rows.length"
  >
    <div
      v-if="$slots.toolbar"
      class="cv-dt-toolbar border-border bg-surface-raised flex items-center gap-2 border-b px-2 py-1.5"
    >
      <slot name="toolbar" :table="table" />
    </div>

    <div
      ref="scrollContainer"
      class="cv-dt-scroll min-h-0 flex-1 overflow-auto"
      :class="{ 'cv-dt-sticky-first-col': stickyFirstColumn }"
    >
      <div class="cv-dt-table" role="rowgroup" :style="tableStyle">
        <div class="cv-dt-thead" role="rowgroup" :class="{ 'cv-dt-sticky-header': stickyHeader }">
          <div
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
            class="cv-dt-row cv-dt-header-row border-border border-b"
            role="row"
          >
            <div
              v-for="(header, headerIndex) in headerGroup.headers"
              :key="header.id"
              role="columnheader"
              class="cv-dt-cell cv-dt-header-cell"
              :class="{
                'cv-dt-sortable': header.column.getCanSort(),
                'cv-dt-sticky-col': stickyFirstColumn && headerIndex === 0,
              }"
              :style="{ width: headerCellWidth(header.getSize()) }"
              :aria-sort="ariaSortFor(header.column.getIsSorted())"
              :tabindex="header.column.getCanSort() ? 0 : -1"
              @click="header.column.getCanSort() && header.column.toggleSorting()"
              @keydown="onHeaderKeydown($event, header)"
            >
              <div class="cv-dt-header-cell-inner">
                <span class="cv-dt-header-title truncate">
                  <slot
                    :name="`header-${header.column.id}`"
                    :column="header.column"
                    :header="header"
                  >
                    <FlexRender
                      v-if="!header.isPlaceholder"
                      :render="header.column.columnDef.header"
                      :props="header.getContext()"
                    />
                  </slot>
                </span>
                <span class="cv-dt-header-icons" aria-hidden="true">
                  <span v-if="header.column.getIsSorted() === 'asc'" class="cv-dt-sort-icon"
                    >▲</span
                  >
                  <span v-else-if="header.column.getIsSorted() === 'desc'" class="cv-dt-sort-icon"
                    >▼</span
                  >
                </span>
              </div>
              <div
                v-if="enableColumnResize && header.column.getCanResize()"
                class="cv-dt-resize-handle"
                @mousedown.stop="header.getResizeHandler()($event)"
                @touchstart.stop="header.getResizeHandler()($event)"
                @click.stop
              />
            </div>
          </div>
        </div>

        <div
          v-if="loading"
          class="cv-dt-status text-muted flex items-center justify-center py-6 text-sm"
        >
          <slot name="loading">{{ loadingMessage }}</slot>
        </div>
        <div
          v-else-if="rows.length === 0"
          class="cv-dt-status text-muted flex items-center justify-center py-6 text-sm"
        >
          <slot name="empty">{{ emptyMessage }}</slot>
        </div>

        <div
          v-else-if="shouldVirtualize"
          class="cv-dt-tbody"
          role="rowgroup"
          :style="{ height: `${totalSize}px`, position: 'relative' }"
        >
          <div
            v-for="virtualRow in virtualItems"
            :key="rows[virtualRow.index]!.id"
            class="cv-dt-row cv-dt-body-row border-border border-b"
            role="row"
            :data-index="virtualRow.index"
            :data-row-id="rows[virtualRow.index]!.id"
            :data-selected="rows[virtualRow.index]!.getIsSelected() ? 'true' : 'false'"
            :class="{
              'cv-dt-zebra': zebraStripes && virtualRow.index % 2 === 1,
              'cv-dt-selected': rows[virtualRow.index]!.getIsSelected(),
            }"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
              height: `${virtualRow.size}px`,
            }"
            @click="onRowClick($event, rows[virtualRow.index]!)"
            @dblclick="onRowDblClick($event, rows[virtualRow.index]!)"
          >
            <div
              v-for="(cell, cellIndex) in rows[virtualRow.index]!.getVisibleCells()"
              :key="cell.id"
              role="cell"
              class="cv-dt-cell cv-dt-body-cell"
              :class="{ 'cv-dt-sticky-col': stickyFirstColumn && cellIndex === 0 }"
              :style="{ width: headerCellWidth(cell.column.getSize()) }"
            >
              <slot
                :name="`cell-${cell.column.id}`"
                :row="rows[virtualRow.index]!.original"
                :value="cell.getValue()"
                :cell="cell"
              >
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </slot>
            </div>
          </div>
        </div>

        <div v-else class="cv-dt-tbody" role="rowgroup">
          <div
            v-for="(row, rowIndex) in rows"
            :key="row.id"
            class="cv-dt-row cv-dt-body-row border-border border-b"
            role="row"
            :data-index="rowIndex"
            :data-row-id="row.id"
            :data-selected="row.getIsSelected() ? 'true' : 'false'"
            :class="{
              'cv-dt-zebra': zebraStripes && rowIndex % 2 === 1,
              'cv-dt-selected': row.getIsSelected(),
            }"
            @click="onRowClick($event, row)"
            @dblclick="onRowDblClick($event, row)"
          >
            <div
              v-for="(cell, cellIndex) in row.getVisibleCells()"
              :key="cell.id"
              role="cell"
              class="cv-dt-cell cv-dt-body-cell"
              :class="{ 'cv-dt-sticky-col': stickyFirstColumn && cellIndex === 0 }"
              :style="{ width: headerCellWidth(cell.column.getSize()) }"
            >
              <slot
                :name="`cell-${cell.column.id}`"
                :row="row.original"
                :value="cell.getValue()"
                :cell="cell"
              >
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </slot>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/*
 * Default row metrics inherit from the global `--density-*` tokens (set on
 * <html> via `data-density`). The per-table `data-density` attribute is
 * still honoured for explicit instance-level overrides — those entries
 * below re-resolve against the global tokens too, so when a consumer sets
 * `:density="compact"` on a table sitting inside a `data-density="spacious"`
 * shell, the table compacts. Themes that change the density-mode tokens
 * automatically flow through.
 */
.commandvue-datatable {
  --cv-dt-row-h: var(--density-row-height);
  --cv-dt-cell-py: var(--density-cell-padding-y);
  --cv-dt-cell-px: var(--density-cell-padding-x);
  --cv-dt-font-size: var(--density-font-size);
}
/* Per-table `<DataTable :density="X">` overrides — re-resolve the same
 * tokens locally so the table can opt out of the global density mode. */
.commandvue-datatable[data-density="compact"] {
  --density-row-height: 1.75rem;
  --density-cell-padding-y: 0.25rem;
  --density-cell-padding-x: 0.5rem;
  --density-font-size: 0.75rem;
}
.commandvue-datatable[data-density="comfortable"] {
  --density-row-height: 2.25rem;
  --density-cell-padding-y: 0.5rem;
  --density-cell-padding-x: 0.75rem;
  --density-font-size: 0.875rem;
}
.commandvue-datatable[data-density="spacious"] {
  --density-row-height: 2.75rem;
  --density-cell-padding-y: 0.75rem;
  --density-cell-padding-x: 1rem;
  --density-font-size: 1rem;
}

.commandvue-datatable .cv-dt-table {
  display: grid;
  grid-auto-rows: max-content;
}
.commandvue-datatable .cv-dt-row {
  display: flex;
  align-items: stretch;
  min-height: var(--cv-dt-row-h);
}
.commandvue-datatable .cv-dt-cell {
  display: flex;
  align-items: center;
  padding: var(--cv-dt-cell-py) var(--cv-dt-cell-px);
  box-sizing: border-box;
  background: inherit;
  min-width: 0;
}
.commandvue-datatable .cv-dt-thead {
  background: var(--color-surface-raised);
  color: var(--color-muted);
  z-index: 2;
}
.commandvue-datatable .cv-dt-sticky-header {
  position: sticky;
  top: 0;
}
.commandvue-datatable .cv-dt-header-cell {
  position: relative;
  font-weight: 500;
  user-select: none;
  outline: none;
}
.commandvue-datatable .cv-dt-header-cell.cv-dt-sortable {
  cursor: pointer;
}
.commandvue-datatable .cv-dt-header-cell:focus-visible {
  box-shadow: inset 0 0 0 2px var(--color-accent-500);
}
.commandvue-datatable .cv-dt-header-cell-inner {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
}
.commandvue-datatable .cv-dt-header-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.commandvue-datatable .cv-dt-sort-icon {
  font-size: 0.65em;
  line-height: 1;
  color: var(--color-accent-500);
}
.commandvue-datatable .cv-dt-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 4px;
  cursor: col-resize;
  user-select: none;
  touch-action: none;
}
.commandvue-datatable .cv-dt-resize-handle:hover {
  background: var(--color-accent-500);
  opacity: 0.4;
}
.commandvue-datatable .cv-dt-body-row {
  background: var(--color-surface);
  transition: background-color 120ms ease;
}
.commandvue-datatable .cv-dt-body-row:hover {
  background: var(--color-surface-raised);
}
.commandvue-datatable .cv-dt-zebra {
  background: var(--color-surface-sunken);
}
.commandvue-datatable .cv-dt-selected {
  background: color-mix(in oklab, var(--color-accent-500) 18%, var(--color-surface));
}
.commandvue-datatable .cv-dt-selected:hover {
  background: color-mix(in oklab, var(--color-accent-500) 24%, var(--color-surface));
}
.commandvue-datatable .cv-dt-sticky-col {
  position: sticky;
  left: 0;
  z-index: 1;
}
.commandvue-datatable .cv-dt-thead .cv-dt-sticky-col {
  z-index: 3;
}
.commandvue-datatable .cv-dt-status {
  grid-column: 1 / -1;
}
</style>
