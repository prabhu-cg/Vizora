import type { Cell, Column, Dataset } from "@/types/visualisation";
import type { ColumnProfile, DatasetProfile } from "./types";

const present = (v: Cell): v is string | number | boolean => v !== null;

function median(sorted: number[]): number | undefined {
  if (!sorted.length) return undefined;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function profileColumn(col: Column, rows: readonly Record<string, Cell>[]): ColumnProfile {
  const values = rows.map((r) => r[col.key] ?? null);
  const filled = values.filter(present);
  const counts = new Map<string, number>();
  for (const v of filled) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([value, count]) => ({ value, count }));
  const p: ColumnProfile = {
    key: col.key,
    label: col.label,
    type: col.type,
    count: filled.length,
    missing: values.length - filled.length,
    missingPct: values.length ? Math.round(((values.length - filled.length) / values.length) * 1000) / 10 : 0,
    distinct: counts.size,
    top,
    notes: [],
  };
  if (col.type === "number") {
    const nums = filled.filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
    if (nums.length) {
      const sum = nums.reduce((a, b) => a + b, 0);
      Object.assign(p, { min: nums[0], max: nums[nums.length - 1], sum, mean: sum / nums.length, median: median(nums) });
    }
  } else if (col.type === "date" || col.type === "string") {
    const strs = filled.map(String).sort();
    if (strs.length) Object.assign(p, { min: strs[0], max: strs[strs.length - 1] });
  }
  return p;
}

/** Count of rows identical to an earlier row. */
export function countDuplicateRows(dataset: Pick<Dataset, "columns" | "rows">): number {
  const seen = new Set<string>();
  let dup = 0;
  for (const r of dataset.rows) {
    const key = JSON.stringify(dataset.columns.map((c) => r[c.key] ?? null));
    if (seen.has(key)) dup++;
    else seen.add(key);
  }
  return dup;
}

export function profileDataset(dataset: Pick<Dataset, "columns" | "rows">): DatasetProfile {
  const columns = dataset.columns.map((c) => profileColumn(c, dataset.rows));
  const cells = dataset.rows.length * dataset.columns.length;
  const missing = columns.reduce((a, c) => a + c.missing, 0);
  return {
    rows: dataset.rows.length,
    columns,
    duplicateRows: countDuplicateRows(dataset),
    completeness: cells ? Math.round(((cells - missing) / cells) * 1000) / 10 : 100,
  };
}
