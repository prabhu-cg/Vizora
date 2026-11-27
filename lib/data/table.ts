import { createId } from "@/lib/utils/id";
import type { Cell, Column, Dataset } from "@/types/visualisation";
import { inferType, normaliseHeaders } from "./build";
import { isMissing, parseBoolean, parseDate, parseNumber, toText } from "./values";

/** Manual data entry: a grid of text that becomes a typed dataset. */
export interface Grid {
  headers: string[];
  rows: string[][];
}

export function emptyGrid(columns = 3, rows = 5): Grid {
  return { headers: Array.from({ length: columns }, (_, i) => `Column ${i + 1}`), rows: Array.from({ length: rows }, () => Array.from({ length: columns }, () => "")) };
}

export function gridFromDataset(d: Dataset): Grid {
  return { headers: d.columns.map((c) => c.label), rows: d.rows.map((r) => d.columns.map((c) => toText(r[c.key]))) };
}

/** Typed cells from grid text: numbers, dates and booleans are recognised the same way as in imports. */
export function datasetFromGrid(grid: Grid, opts: { id?: string; name?: string; origin?: Dataset["origin"] } = {}): Dataset {
  const names = normaliseHeaders(grid.headers);
  const rows = grid.rows.filter((r) => r.some((c) => !isMissing(c)));
  const columns: Column[] = names.map((n, c) => ({ key: n.key, label: n.label, type: inferType(rows.map((r) => r[c] ?? "")) }));
  const cell = (v: string, t: Column["type"]): Cell => {
    if (isMissing(v)) return null;
    if (t === "number") return parseNumber(v)?.value ?? null;
    if (t === "boolean") return parseBoolean(v) ?? null;
    if (t === "date") return parseDate(v)?.value ?? null;
    return v.trim();
  };
  return {
    id: opts.id ?? createId(),
    name: (opts.name ?? "Manual data").slice(0, 200) || "Manual data",
    origin: opts.origin ?? "manual",
    columns,
    rows: rows.map((r) => Object.fromEntries(columns.map((c, i) => [c.key, cell(r[i] ?? "", c.type)]))),
  };
}

export function setCell(g: Grid, row: number, col: number, value: string): Grid {
  return { ...g, rows: g.rows.map((r, i) => (i === row ? r.map((c, j) => (j === col ? value : c)) : r)) };
}
export const addRow = (g: Grid): Grid => ({ ...g, rows: [...g.rows, g.headers.map(() => "")] });
export const removeRow = (g: Grid, row: number): Grid => ({ ...g, rows: g.rows.filter((_, i) => i !== row) });
export function addColumn(g: Grid): Grid {
  return { headers: [...g.headers, `Column ${g.headers.length + 1}`], rows: g.rows.map((r) => [...r, ""]) };
}
export function removeColumn(g: Grid, col: number): Grid {
  if (g.headers.length <= 1) return g;
  return { headers: g.headers.filter((_, i) => i !== col), rows: g.rows.map((r) => r.filter((_, j) => j !== col)) };
}
export const setHeader = (g: Grid, col: number, value: string): Grid => ({ ...g, headers: g.headers.map((h, i) => (i === col ? value : h)) });
