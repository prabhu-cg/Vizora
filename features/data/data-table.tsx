"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import type { Cell } from "@/types/visualisation";

export interface TableColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

/** Read-only, sortable, searchable, paginated table. For inspecting data, never for changing it. */
export function DataTable({ columns, rows, caption, pageSize = 25 }: { columns: TableColumn[]; rows: Record<string, Cell>[]; caption: string; pageSize?: number }) {
  const id = useId();
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>();
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q ? rows.filter((r) => columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))) : rows;
    if (sort) {
      const dir = sort.dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const x = a[sort.key] ?? null, y = b[sort.key] ?? null;
        if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1; // empty values always last
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir;
      });
    }
    return out;
  }, [rows, columns, query, sort]);

  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = shown.slice(current * pageSize, current * pageSize + pageSize);
  const toggle = (key: string) => setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : undefined) : { key, dir: "asc" }));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`${id}-q`} className="sr-only">Search rows</label>
        <Input id={`${id}-q`} type="search" placeholder="Search rows" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} className="h-9 max-w-xs" />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {shown.length.toLocaleString()} of {rows.length.toLocaleString()} row{rows.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="overflow-auto rounded-card border border-border" tabIndex={0} role="region" aria-label={`${caption}, scrollable`}>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-surface">
            <tr>
              <th scope="col" className="w-12 border-b border-border px-3 py-2 text-right text-xs font-semibold text-muted-foreground">#</th>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("border-b border-border px-3 py-2 font-semibold", c.numeric ? "text-right" : "text-left")}>
                    <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 rounded-sm hover:text-primary-text">
                      {c.label}
                      {active && (sort!.dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowDown className="size-3.5" aria-hidden="true" />)}
                      <span className="sr-only">, sort</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={current * pageSize + i} className="odd:bg-card even:bg-surface/60">
                <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted-foreground">{current * pageSize + i + 1}</td>
                {columns.map((c) => {
                  const v = r[c.key] ?? null;
                  return (
                    <td key={c.key} className={cn("max-w-64 truncate px-3 py-1.5", c.numeric && "text-right tabular-nums")} title={v === null ? undefined : String(v)}>
                      {v === null ? <span aria-label="empty" className="text-muted-foreground">—</span> : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted-foreground">No rows match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Table pages" className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft aria-hidden="true" /> Previous</Button>
          <span className="text-sm text-muted-foreground tabular-nums">Page {current + 1} of {pages}</span>
          <Button variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next <ChevronRight aria-hidden="true" /></Button>
        </nav>
      )}
    </div>
  );
}
