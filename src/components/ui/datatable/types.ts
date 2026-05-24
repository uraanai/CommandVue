/**
 * Public types for the CommandVue `<DataTable>` wrapper.
 *
 * Re-exports the TanStack Vue Table types consumers most often need, so call
 * sites can do `import type { ColumnDef } from "@/components/ui/datatable/types"`
 * without having to know which package the underlying library lives in.
 */
import type { ColumnDef } from "@tanstack/vue-table";

export type {
  CellContext,
  Column,
  ColumnDef,
  ColumnFiltersState,
  ColumnPinningState,
  ColumnSizingState,
  CoreRow,
  HeaderContext,
  Row,
  RowSelectionState,
  SortingState,
  Table as TanStackTable,
  VisibilityState,
} from "@tanstack/vue-table";

export type DataTableDensity = "compact" | "comfortable" | "spacious";

export type DataTableSelectionMode = "none" | "single" | "multiple";

/**
 * Loose column-array type used by the wrapper's `columns` prop. The second
 * generic of `ColumnDef` is invariant; this widening lets a mixed array of
 * column definitions (each typed with their own value type) flow into the
 * wrapper without per-column casts at the call site.
 */
export type DataTableColumn<TData> = ColumnDef<TData> | ColumnDef<TData, never>;

export interface DataTableProps<TData> {
  data: TData[];
  columns: DataTableColumn<TData>[];
  rowKey?: keyof TData | ((row: TData) => string);
  density?: DataTableDensity;
  enableSorting?: boolean;
  enableColumnResize?: boolean;
  enableColumnVisibility?: boolean;
  enableFiltering?: boolean;
  enableVirtualization?: boolean | "auto";
  selectionMode?: DataTableSelectionMode;
  stickyHeader?: boolean;
  stickyFirstColumn?: boolean;
  zebraStripes?: boolean;
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  estimatedRowHeight?: number;
  containerHeight?: string;
  globalFilter?: string;
}
