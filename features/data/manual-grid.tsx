"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addColumn, addRow, removeColumn, removeRow, setCell, setHeader, type Grid } from "@/lib/data";

/** A small spreadsheet for typing data in. Numbers, dates and yes/no are recognised when it is added. */
export function ManualGrid({ grid, onChange }: { grid: Grid; onChange: (g: Grid) => void }) {
  return (
    <div className="grid gap-3">
      <div className="overflow-auto rounded-card border border-border" tabIndex={0} role="region" aria-label="Data entry grid, scrollable">
        <table className="border-collapse text-sm">
          <caption className="sr-only">Type your data. The first row holds the column names.</caption>
          <thead className="bg-surface">
            <tr>
              <th scope="col" className="w-10 px-2 py-1.5 text-xs text-muted-foreground"><span className="sr-only">Row</span></th>
              {grid.headers.map((h, c) => (
                <th key={c} scope="col" className="min-w-36 p-1 text-left">
                  <div className="flex items-center gap-1">
                    <Input aria-label={`Column ${c + 1} name`} value={h} maxLength={200} onChange={(e) => onChange(setHeader(grid, c, e.target.value))} className="h-9 font-semibold" />
                    <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Remove column ${h || c + 1}`} disabled={grid.headers.length <= 1} onClick={() => onChange(removeColumn(grid, c))}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, r) => (
              <tr key={r}>
                <th scope="row" className="px-2 text-right text-xs font-normal tabular-nums text-muted-foreground">
                  <div className="flex items-center justify-end gap-1">
                    {r + 1}
                    <Button variant="ghost" size="icon" className="size-7" aria-label={`Remove row ${r + 1}`} onClick={() => onChange(removeRow(grid, r))}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </th>
                {row.map((cell, c) => (
                  <td key={c} className="p-1">
                    <Input aria-label={`Row ${r + 1}, ${grid.headers[c] || `column ${c + 1}`}`} value={cell} onChange={(e) => onChange(setCell(grid, r, c, e.target.value))} className="h-9" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onChange(addRow(grid))} disabled={grid.rows.length >= 500}><Plus aria-hidden="true" /> Add row</Button>
        <Button variant="outline" size="sm" onClick={() => onChange(addColumn(grid))} disabled={grid.headers.length >= 30}><Plus aria-hidden="true" /> Add column</Button>
      </div>
    </div>
  );
}
