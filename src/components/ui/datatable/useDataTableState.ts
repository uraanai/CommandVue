import type {
  ColumnFiltersState,
  ColumnSizingState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "./types";

import { ref, type Ref } from "vue";

/**
 * Composable that bundles the four pieces of table state most consumers want
 * to control or persist: sorting, filtering, column visibility, column sizing.
 * Row selection is included for completeness even though the wrapper renders
 * its own selection UI.
 *
 * Each piece is a plain `ref` so callers can `watch` it for persistence (e.g.
 * `panelStateRepo.save`) or initialize it from restored state.
 *
 * The wrapper builds its own internal state by default — this composable is
 * only needed when external persistence or programmatic control is required.
 */
export interface DataTableStateInit {
  sorting?: SortingState;
  filters?: ColumnFiltersState;
  visibility?: VisibilityState;
  sizing?: ColumnSizingState;
  selection?: RowSelectionState;
  globalFilter?: string;
}

export interface DataTableState {
  sorting: Ref<SortingState>;
  filters: Ref<ColumnFiltersState>;
  visibility: Ref<VisibilityState>;
  sizing: Ref<ColumnSizingState>;
  selection: Ref<RowSelectionState>;
  globalFilter: Ref<string>;
  reset: () => void;
}

export function useDataTableState(init: DataTableStateInit = {}): DataTableState {
  const initial = {
    sorting: init.sorting ?? [],
    filters: init.filters ?? [],
    visibility: init.visibility ?? {},
    sizing: init.sizing ?? {},
    selection: init.selection ?? {},
    globalFilter: init.globalFilter ?? "",
  };

  const sorting = ref<SortingState>(initial.sorting) as Ref<SortingState>;
  const filters = ref<ColumnFiltersState>(initial.filters) as Ref<ColumnFiltersState>;
  const visibility = ref<VisibilityState>(initial.visibility) as Ref<VisibilityState>;
  const sizing = ref<ColumnSizingState>(initial.sizing) as Ref<ColumnSizingState>;
  const selection = ref<RowSelectionState>(initial.selection) as Ref<RowSelectionState>;
  const globalFilter = ref<string>(initial.globalFilter);

  function reset(): void {
    sorting.value = [];
    filters.value = [];
    visibility.value = {};
    sizing.value = {};
    selection.value = {};
    globalFilter.value = "";
  }

  return { sorting, filters, visibility, sizing, selection, globalFilter, reset };
}
