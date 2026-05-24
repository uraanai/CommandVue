import { createColumnHelper, type ColumnDef } from "@tanstack/vue-table";
import dayjs from "dayjs";

export { createColumnHelper };

/**
 * Build a column that renders an ISO date or millisecond timestamp using a
 * dayjs format string.
 *
 * @example
 *   const cols = [
 *     formatDateColumn<Entity>("lastSeen", { header: "Seen", format: "HH:mm:ss" }),
 *   ];
 */
export function formatDateColumn<TData>(
  accessor: keyof TData & string,
  options: { header: string; format?: string; id?: string } = { header: accessor },
): ColumnDef<TData> {
  const format = options.format ?? "YYYY-MM-DD HH:mm";
  return {
    id: options.id ?? accessor,
    accessorKey: accessor,
    header: options.header,
    cell: (info) => {
      const value = info.getValue();
      if (value === null || value === undefined || value === "") return "—";
      return dayjs(value as string | number | Date).format(format);
    },
  };
}

/**
 * Build a column that renders a number with locale-aware formatting and an
 * optional fixed precision.
 */
export function formatNumberColumn<TData>(
  accessor: keyof TData & string,
  options: {
    header: string;
    precision?: number;
    suffix?: string;
    id?: string;
  } = { header: accessor },
): ColumnDef<TData> {
  const precision = options.precision;
  const suffix = options.suffix ?? "";
  return {
    id: options.id ?? accessor,
    accessorKey: accessor,
    header: options.header,
    cell: (info) => {
      const value = info.getValue();
      if (value === null || value === undefined) return "—";
      const n = Number(value);
      if (!Number.isFinite(n)) return "—";
      const formatted = precision === undefined ? n.toLocaleString() : n.toFixed(precision);
      return `${formatted}${suffix}`;
    },
  };
}
