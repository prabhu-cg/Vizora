import { applyFilters } from "@/lib/charts/query";
import { sortKeyOf } from "@/lib/engine/interpret/dates";
import type { Cell, Column, Dataset } from "@/types/visualisation";
import type { TableConfig } from "./config";

type Row = Record<string, Cell>;

export interface TableView {
  /** The columns to show, in order. Columns that no longer exist in the dataset are dropped. */
  columns: Column[];
  /** Rows after filters and sort: every row, not one page. */
  rows: Row[];
  total: number;
  /** For colour scales and data bars: each formatted column's smallest and largest value among the rows shown. */
  ranges: Record<string, { min: number; max: number }>;
  notes: string[];
}

function compare(a: Cell, b: Cell, type: Column["type"]): number {
  if (type === "number") return (a as number) - (b as number);
  if (type === "date") {
    const ka = sortKeyOf(String(a)), kb = sortKeyOf(String(b));
    if (ka !== undefined && kb !== undefined) return ka - kb;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** Sort rows by a column. Empty values always come last, whichever way the sort runs. Stable, so ties keep their order. */
export function sortRows(rows: readonly Row[], col: Column, dir: "asc" | "desc"): Row[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      const a = x.r[col.key] ?? null, b = y.r[col.key] ?? null;
      const ea = a === null || a === "", eb = b === null || b === "";
      if (ea || eb) return ea === eb ? x.i - y.i : ea ? 1 : -1;
      return compare(a, b, col.type) * sign || x.i - y.i;
    })
    .map((x) => x.r);
}

/**
 * Exactly what a table shows, from the dataset and its settings. Pure, so the
 * screen, the CSV and the image export all agree.
 */
export function buildTableView(dataset: Pick<Dataset, "columns" | "rows">, config: TableConfig): TableView {
  const notes: string[] = [];
  const byKey = new Map(dataset.columns.map((c) => [c.key, c]));
  let columns = config.columns ? config.columns.map((k) => byKey.get(k)).filter((c): c is Column => !!c) : [...dataset.columns];
  if (config.columns && columns.length < config.columns.length) notes.push(`${config.columns.length - columns.length} column${config.columns.length - columns.length === 1 ? " is" : "s are"} no longer in this dataset and ${config.columns.length - columns.length === 1 ? "was" : "were"} left out.`);
  if (config.columns && columns.length === 0) columns = [...dataset.columns];

  let rows = applyFilters(dataset, config.filters);
  if (rows.length < dataset.rows.length) notes.push(`${(dataset.rows.length - rows.length).toLocaleString()} row${dataset.rows.length - rows.length === 1 ? " is" : "s are"} hidden by filters.`);
  const sortCol = config.sort ? byKey.get(config.sort.key) : undefined;
  if (sortCol && config.sort) rows = sortRows(rows, sortCol, config.sort.dir);

  const ranges: TableView["ranges"] = {};
  for (const c of columns) {
    if (c.type !== "number" || !config.formats[c.key]) continue;
    let min = Infinity, max = -Infinity;
    for (const r of rows) {
      const v = r[c.key];
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (min <= max) ranges[c.key] = { min, max };
  }
  return { columns, rows, total: dataset.rows.length, ranges, notes };
}

/** Where a value falls between a column's smallest and largest, 0 to 1. A column of one repeated value reads as full. */
export function fraction(value: Cell, range: { min: number; max: number } | undefined): number | undefined {
  if (!range || typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return range.max === range.min ? 1 : (value - range.min) / (range.max - range.min);
}

/** Show or hide a column, keeping the others in their current order. Never leaves the table with no columns. */
export function toggleColumn(all: readonly Column[], current: readonly string[] | undefined, key: string): string[] {
  const shown = current ? current.filter((k) => all.some((c) => c.key === k)) : all.map((c) => c.key);
  if (shown.includes(key)) return shown.length > 1 ? shown.filter((k) => k !== key) : shown;
  return [...shown, key]; // a column you bring back joins at the end; move it from there
}

/** Move a shown column one place left or right. */
export function moveColumn(shown: readonly string[], key: string, delta: -1 | 1): string[] {
  const i = shown.indexOf(key), j = i + delta;
  if (i === -1 || j < 0 || j >= shown.length) return [...shown];
  const next = [...shown];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}
