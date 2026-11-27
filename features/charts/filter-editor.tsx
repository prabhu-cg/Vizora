"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FILTER_OPS, FILTER_OP_LABEL, type ChartFilter } from "@/lib/charts";
import type { Column } from "@/types/visualisation";

export const MAX_FILTERS = 20;

/** Rows to show, by column: shared by charts and tables. Filters change the view, never the data. */
export function FilterEditor({ cols, filters, onChange, noun = "chart" }: { cols: readonly Column[]; filters: readonly ChartFilter[]; onChange: (next: (filters: ChartFilter[]) => ChartFilter[], coalesceKey?: string) => void; noun?: string }) {
  const patch = (i: number, p: Partial<ChartFilter>, key?: string) => onChange((fs) => fs.map((x, j) => (j === i ? { ...x, ...p } : x)), key);
  return (
    <>
      {filters.length === 0 && <p className="text-xs text-muted-foreground">Show only some rows. Filters affect this {noun}, never your data.</p>}
      <ul className="grid gap-3">
        {filters.map((f, i) => {
          const col = cols.find((c) => c.key === f.column);
          const noValue = f.op === "empty" || f.op === "notEmpty";
          return (
            <li key={i} className="grid gap-1.5 rounded-input border border-border p-2.5">
              <Select aria-label={`Filter ${i + 1} column`} value={f.column} onChange={(e) => patch(i, { column: e.target.value })} className="h-9">
                {cols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
              <Select aria-label={`Filter ${i + 1} condition`} value={f.op} onChange={(e) => patch(i, { op: e.target.value as ChartFilter["op"] })} className="h-9">
                {FILTER_OPS.map((o) => <option key={o} value={o}>{FILTER_OP_LABEL[o]}</option>)}
              </Select>
              {!noValue && <Input aria-label={`Filter ${i + 1} value`} value={f.value} placeholder={f.op === "in" ? "a, b, c" : col?.type === "date" ? "2026-01-31" : "value"} onChange={(e) => patch(i, { value: e.target.value }, `filter:${i}`)} className="h-9" />}
              <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => onChange((fs) => fs.filter((_, j) => j !== i))} aria-label={`Remove filter ${i + 1}`}><Trash2 aria-hidden="true" /> Remove</Button>
            </li>
          );
        })}
      </ul>
      <Button variant="outline" size="sm" disabled={cols.length === 0 || filters.length >= MAX_FILTERS} onClick={() => onChange((fs) => [...fs, { column: cols[0]!.key, op: "eq", value: "" }])}>
        <Plus aria-hidden="true" /> Add filter
      </Button>
    </>
  );
}
