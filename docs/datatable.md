# DataTable

`<DataTable>` is CommandVue's default tabular-data primitive. It wraps `@tanstack/vue-table` (state) and `@tanstack/vue-virtual` (windowing) behind a typed, slot-driven API shaped for high-density operations dashboards.

> **Policy.** `@tanstack/vue-table` is the default. `primevue/datatable` is the escape valve and requires PR-level justification — see `docs/decisions/0001-datatable-library.md`. An ESLint warn-level rule and PR labeler surface the deviation automatically.

## Quick start

```vue
<script setup lang="ts">
import { computed, ref } from "vue";

import DataTable from "@/components/ui/DataTable.vue";
import { createColumnHelper } from "@/components/ui/datatable/columnHelpers";

interface Asset {
  id: string;
  name: string;
  status: "active" | "standby" | "offline";
}

const data = ref<Asset[]>([
  { id: "A-001", name: "Aurora", status: "active" },
  { id: "A-002", name: "Beacon", status: "standby" },
]);

const helper = createColumnHelper<Asset>();
const columns = computed(() => [
  helper.accessor("id", { header: "ID", size: 110 }),
  helper.accessor("name", { header: "Name", size: 200 }),
  helper.accessor("status", { header: "Status", size: 120 }),
]);
</script>

<template>
  <DataTable :data="data" :columns="columns" row-key="id" />
</template>
```

That's the full minimum surface. The wrapper auto-renders sortable headers, applies a sticky header, hooks up filtering and column visibility, and switches to virtualized rendering once the row count exceeds 100.

## Props

| Prop                     | Type                                       | Default               | Notes                                                                          |
| ------------------------ | ------------------------------------------ | --------------------- | ------------------------------------------------------------------------------ |
| `data`                   | `TData[]`                                  | (required)            | Rows to render.                                                                |
| `columns`                | `ColumnDef<TData>[]`                       | (required)            | Build with `createColumnHelper<TData>()` for inferred value types.             |
| `rowKey`                 | `keyof TData \| (row) => string`           | `undefined` (index)   | Stable id used by TanStack for selection and re-render keys.                   |
| `density`                | `"compact" \| "comfortable" \| "spacious"` | `"comfortable"`       | Switches row height, padding, and font-size via CSS variables.                 |
| `enableSorting`          | `boolean`                                  | `true`                | Enables click + keyboard (Enter / Space) sorting.                              |
| `enableColumnResize`     | `boolean`                                  | `true`                | Renders a 4 px draggable handle on each header.                                |
| `enableColumnVisibility` | `boolean`                                  | `true`                | Surfaces visibility state via the table API and emits.                         |
| `enableFiltering`        | `boolean`                                  | `true`                | Enables global filtering and per-column filters.                               |
| `enableVirtualization`   | `boolean \| "auto"`                        | `"auto"`              | `"auto"` ⇒ on above 100 rows.                                                  |
| `selectionMode`          | `"none" \| "single" \| "multiple"`         | `"none"`              | Multi-select uses `Ctrl/Cmd/Shift+click`.                                      |
| `stickyHeader`           | `boolean`                                  | `true`                | `position: sticky` on `<thead>`.                                               |
| `stickyFirstColumn`      | `boolean`                                  | `false`               | First column gets `position: sticky; left: 0`.                                 |
| `zebraStripes`           | `boolean`                                  | `false`               | Alternating row backgrounds.                                                   |
| `emptyMessage`           | `string`                                   | `"No data available"` | Used when `data.length === 0` and `loading` is false.                          |
| `loading`                | `boolean`                                  | `false`               | Shows the loading slot instead of rows.                                        |
| `loadingMessage`         | `string`                                   | `"Loading…"`          | Default loading text when no slot is supplied.                                 |
| `estimatedRowHeight`     | `number`                                   | `36`                  | Virtualizer hint in pixels; tune per density.                                  |
| `containerHeight`        | `string`                                   | `"100%"`              | CSS height of the outer container.                                             |
| `globalFilter`           | `string`                                   | `""`                  | One-way binding; the wrapper emits `global-filter-change` for two-way control. |

## Events

| Event                      | Payload                           | Notes                                         |
| -------------------------- | --------------------------------- | --------------------------------------------- |
| `row-click`                | `(row: TData, event: MouseEvent)` | Fires after the internal selection update.    |
| `row-dblclick`             | `(row: TData, event: MouseEvent)` | Useful for "open detail" interactions.        |
| `selection-change`         | `(rows: TData[])`                 | Emitted only when `selectionMode !== "none"`. |
| `sort-change`              | `(sorting: SortingState)`         | Suitable for `panelStateRepo.save`.           |
| `column-visibility-change` | `(visibility: VisibilityState)`   | Persist for "remember my view" UX.            |
| `column-resize-change`     | `(sizing: ColumnSizingState)`     | Same.                                         |
| `global-filter-change`     | `(value: string)`                 | For two-way binding the global filter.        |

## Slots

| Slot                | Scope                  | Purpose                                                              |
| ------------------- | ---------------------- | -------------------------------------------------------------------- |
| `toolbar`           | `{ table }`            | Renders above the scroll area; receives the TanStack table instance. |
| `empty`             | —                      | Overrides the default empty-state content.                           |
| `loading`           | —                      | Overrides the default loading-state content.                         |
| `header-<columnId>` | `{ column, header }`   | Custom header for a single column.                                   |
| `cell-<columnId>`   | `{ row, value, cell }` | Custom cell renderer; falls back to `columnDef.cell`.                |

The column id is whatever you pass to `accessor` or `display` (or the accessor key if omitted).

## Common patterns

### Sortable column with a custom cell

```ts
helper.accessor("speedKnots", {
  header: "Speed",
  size: 110,
  cell: (info) => `${(info.getValue() as number).toFixed(1)} kn`,
});
```

### Density toggle in the toolbar

```vue
<DataTable :data="rows" :columns="cols" :density="density">
  <template #toolbar>
    <Select :model-value="density" :options="densityOptions" @update:model-value="onDensityChange" />
  </template>
</DataTable>
```

### Persist sort + filter + visibility to panel state

```ts
const { sorting, globalFilter, visibility } = useDataTableState({
  sorting: panelState.value?.sort ?? [],
  visibility: panelState.value?.visibility ?? {},
  globalFilter: panelState.value?.filterText ?? "",
});

watch([sorting, globalFilter, visibility], () => {
  panelStateRepo.save(panelId, {
    sort: sorting.value,
    visibility: visibility.value,
    filterText: globalFilter.value,
  });
});
```

### Multi-select with Ctrl/Cmd/Shift+click

```vue
<DataTable :data="rows" :columns="cols" selection-mode="multiple" @selection-change="onSelected" />
```

### Sticky first column with a row-detail action

```vue
<DataTable :data="rows" :columns="cols" sticky-header sticky-first-column row-key="id" />
```

## Demo

A reference page lives at `/dev/datatable`. It mounts 1,000 mock rows so you can see virtualization, all three densities, sticky behavior, sort, filter, column visibility, and column resize. The `/dev/*` routes are gated behind `import.meta.env.DEV` and never ship in production builds.

## Performance

Virtualization auto-activates once row count exceeds 100. Tune the estimate so the virtualizer doesn't have to re-measure every row:

| Density       | Recommended `estimatedRowHeight` |
| ------------- | -------------------------------- |
| `compact`     | `28`                             |
| `comfortable` | `36`                             |
| `spacious`    | `44`                             |

The wrapper uses CSS grid for the table body so column widths stay in lockstep between `<thead>` and `<tbody>` even when rows are absolutely positioned during virtualization.

## Accessibility

- Outer container has `role="table"`.
- Sortable headers expose `aria-sort` reflecting current direction and are keyboard-focusable (`tabindex="0"`); Enter or Space toggles sort.
- Body cells use `role="cell"`; rows use `role="row"`.
- Focus styling is driven by the project's `--color-accent-500` token, matching the rest of the app.

## Migration guide (PrimeVue DataTable → wrapper)

PrimeVue's `DataTable` + `Column` map onto the wrapper as follows:

| PrimeVue concept                               | Wrapper equivalent                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `<DataTable :value="rows" data-key="id">`      | `<DataTable :data="rows" row-key="id">`                                                             |
| `<Column field="name" header="Name" sortable>` | `helper.accessor("name", { header: "Name" })`                                                       |
| `<Column header="Action">` + body slot         | `helper.display({ id: "action", header: "Action", cell: ({ row }) => ... })`                        |
| `:pt="{ ... }"` styling                        | Edit `src/components/ui/DataTable.vue` `<style>` block or override the CSS variables from a parent. |
| `sort-field` + `sort-order`                    | `state.sorting` via `useDataTableState`.                                                            |
| `size="small"`                                 | `density="compact"`.                                                                                |

For `editMode="row"` (manage dialogs), staying on `primevue/datatable` is acceptable — flag the file with the `governance: primevue-datatable` label and justify in the PR.

### Worked example — `EntityListPanel`

The reference migration is `src/components/panels/EntityListPanel.vue`. Before-and-after shape:

**Before** (PrimeVue, ~120 LOC):

```vue
<script setup lang="ts">
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import { computed } from "vue";
// ...
const tablePT = {
  /* ~10 :pt class overrides */
};
</script>

<template>
  <DataTable
    :value="data"
    data-key="id"
    sort-field="name"
    :sort-order="1"
    size="small"
    :pt="tablePT"
  >
    <Column header="" header-style="width: 2rem">
      <template #body="{ data: row }">...</template>
    </Column>
    <Column field="name" header="Callsign" sortable>...</Column>
    <!-- five more columns -->
  </DataTable>
</template>
```

**After** (wrapper):

```vue
<script setup lang="ts">
import DataTable from "@/components/ui/DataTable.vue";
import { createColumnHelper } from "@/components/ui/datatable/columnHelpers";
import type { SortingState, VisibilityState, DataTableDensity } from "@/components/ui/datatable/types";

const helper = createColumnHelper<Entity>();
const columns = computed(() => [
  helper.display({ id: "symbol", header: "", size: 36, enableSorting: false, enableHiding: false }),
  helper.accessor("name", { id: "name", header: "Callsign", size: 160 }),
  helper.accessor("affiliation", { id: "affiliation", header: "Affiliation", size: 120 }),
  // ...
]);

const persisted = props.api
  ? usePanelState<EntityListPanelState>(props.api.id, {
      serialize: () => ({ sorting: sorting.value, filterText: filterText.value, ... }),
      restore: (s) => { /* re-hydrate refs */ },
    })
  : null;
</script>

<template>
  <DataTable
    :data="data"
    :columns="columns"
    row-key="id"
    :density="density"
    :sticky-first-column="true"
    :global-filter="filterText"
    @sort-change="onSortChange"
    @global-filter-change="onGlobalFilterChange"
    @column-visibility-change="onVisibilityChange"
  >
    <template #toolbar>...</template>
    <template #cell-symbol="{ row }">...</template>
    <template #cell-name="{ row }">...</template>
    <!-- five more cell slots -->
  </DataTable>
</template>
```

What changed:

- Custom cell rendering moves from `<Column>` body slots to `cell-<columnId>` slots on the wrapper.
- The `:pt` class-override stack is gone; styling lives in the wrapper's `<style>` block and CSS variables.
- Panel state (sort / filter / visibility / density) is serialized via `usePanelState`. The wrapper's `@sort-change`, `@global-filter-change`, and `@column-visibility-change` emits drive the `save()` call.
- Default density is `compact` (high-density list).
- `sticky-first-column` is on so the symbology icon stays visible during horizontal scroll.
- Header content and filter-icon alignment is correct by construction — the wrapper's `<th>` uses CSS grid `1fr auto`, eliminating the case-by-case flex misalignment from the PrimeVue version.

## See also

- `docs/decisions/0001-datatable-library.md` — full policy rationale.
- `docs/audits/datatable-usage-inventory.md` — current migration state.
- `src/views/dev/DataTableDemoView.vue` — reference implementation.
- `tests/unit/components/ui/DataTable.spec.ts` — testable surface area.
