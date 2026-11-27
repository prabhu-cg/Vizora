"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Table2 } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterEditor } from "@/features/charts/filter-editor";
import { datasetOf } from "@/lib/charts";
import { FORMAT_LABEL, buildTableView, fraction, moveColumn, readTableConfig, toggleColumn, withTable, type TableConfig, type TableFormat } from "@/lib/tables";
import type { UpdateOptions } from "@/features/visualisation/use-visualisation-editor";
import { cn } from "@/lib/utils/cn";
import type { Cell, VisualisationIR } from "@/types/visualisation";

type Update = (updater: (d: VisualisationIR) => VisualisationIR, options?: UpdateOptions) => void;

export function useTableDocument(doc: VisualisationIR, update: Update) {
  const config = useMemo(() => readTableConfig(doc.configuration.options), [doc.configuration.options]);
  const dataset = datasetOf(doc, config.datasetId);
  const view = useMemo(() => (dataset ? buildTableView(dataset, config) : undefined), [dataset, config]);
  const change = (fn: (c: TableConfig) => TableConfig, coalesceKey?: string) =>
    update((d) => {
      const cur = readTableConfig(d.configuration.options);
      const next = fn({ ...cur, datasetId: datasetOf(d, cur.datasetId)?.id });
      return JSON.stringify(next) === JSON.stringify(cur) ? d : withTable(d, next);
    }, coalesceKey ? { coalesceKey } : undefined);
  return { config, dataset, view, change };
}

const show = (v: Cell): string => (v === null || v === "" ? "" : typeof v === "number" ? new Intl.NumberFormat("en", { maximumFractionDigits: 6 }).format(v) : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));

/** The table: sortable headers, search, paging, and colour scales or data bars where chosen. */
export function TableCentre({ doc, update, onAddData }: { doc: VisualisationIR; update: Update; onAddData: () => void }) {
  const { config, dataset, view, change } = useTableDocument(doc, update);
  const id = useId();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const shown = useMemo(() => {
    if (!view) return [];
    const q = query.trim().toLowerCase();
    return q ? view.rows.filter((r) => view.columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))) : view.rows;
  }, [view, query]);

  if (!dataset || !view) {
    return (
      <div className="grid h-full min-h-80 place-items-center p-6">
        <EmptyState icon={Table2} title="No data to show yet" description="Add a dataset from the Data panel, and it appears here as a table you can sort, filter and format." action={<Button onClick={onAddData}>Add data</Button>} />
      </div>
    );
  }

  const pages = Math.max(1, Math.ceil(shown.length / config.pageSize));
  const current = Math.min(page, pages - 1);
  const slice = shown.slice(current * config.pageSize, (current + 1) * config.pageSize);
  const pad = config.density === "compact" ? "px-3 py-1" : "px-3 py-2";
  const toggleSort = (key: string) => {
    setPage(0);
    change((c) => ({ ...c, sort: c.sort?.key === key ? (c.sort.dir === "asc" ? { key, dir: "desc" } : undefined) : { key, dir: "asc" } }), "table:sort");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2">
        <Label htmlFor={`${id}-q`} className="sr-only">Search rows</Label>
        <Input id={`${id}-q`} type="search" placeholder="Search rows" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} className="h-9 max-w-xs" />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {shown.length.toLocaleString()} of {view.total.toLocaleString()} row{view.total === 1 ? "" : "s"}
          {view.notes.length > 0 && <> · {view.notes.join(" ")}</>}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto" tabIndex={0} role="region" aria-label={`${doc.title || "Table"}, scrollable`}>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{doc.title || dataset.name}</caption>
          <thead className="sticky top-0 z-10 bg-surface">
            <tr>
              <th scope="col" className="w-12 border-b border-border px-3 py-2 text-right text-xs font-semibold text-muted-foreground">#</th>
              {view.columns.map((c) => {
                const active = config.sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (config.sort!.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("border-b border-border px-3 py-2 font-semibold", c.type === "number" ? "text-right" : "text-left")}>
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 rounded-sm hover:text-primary-text">
                      {c.label}
                      {active && (config.sort!.dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowDown className="size-3.5" aria-hidden="true" />)}
                      <span className="sr-only">, sort</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={current * config.pageSize + i} className="odd:bg-card even:bg-surface/50">
                <td className={cn("text-right text-xs tabular-nums text-muted-foreground", pad)}>{current * config.pageSize + i + 1}</td>
                {view.columns.map((c) => {
                  const f = config.formats[c.key];
                  const frac = f ? fraction(r[c.key] ?? null, view.ranges[c.key]) : undefined;
                  const style =
                    frac === undefined ? undefined
                    : f === "bars" ? { backgroundImage: `linear-gradient(to right, color-mix(in srgb, var(--primary) 45%, transparent) ${Math.round(frac * 100)}%, transparent ${Math.round(frac * 100)}%)` }
                    : { backgroundColor: `color-mix(in srgb, var(--primary) ${Math.round(8 + frac * 40)}%, transparent)` };
                  return (
                    <td key={c.key} style={style} className={cn("max-w-72 truncate", pad, c.type === "number" ? "text-right tabular-nums" : "text-left")} title={show(r[c.key] ?? null)}>
                      {show(r[c.key] ?? null)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {slice.length === 0 && (
              <tr><td colSpan={view.columns.length + 1} className="px-3 py-8 text-center text-muted-foreground">{query ? "No rows match your search." : "No rows to show. Check the filters in Settings."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Table pages" className="flex items-center justify-between gap-2 border-t border-border bg-surface px-4 py-2 text-sm">
          <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft aria-hidden="true" /> Previous</Button>
          <span aria-live="polite">Page {current + 1} of {pages}</span>
          <Button variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next <ChevronRight aria-hidden="true" /></Button>
        </nav>
      )}
    </div>
  );
}

function Section({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="grid gap-4 px-4 pb-5">{children}</div>
    </details>
  );
}

/** Columns, sorting, formats and filters for the table. */
export function TableSettings({ doc, update }: { doc: VisualisationIR; update: Update }) {
  const { config, dataset, view, change } = useTableDocument(doc, update);
  const id = useId();
  if (!dataset || !view) return <p className="p-4 text-sm text-muted-foreground">Table settings appear here once you add data.</p>;
  const cols = dataset.columns;
  const shownKeys = view.columns.map((c) => c.key);
  const hidden = cols.filter((c) => !shownKeys.includes(c.key));
  const label = (k: string) => cols.find((c) => c.key === k)?.label ?? k;
  return (
    <section aria-label="Table settings">
      <Section title="Columns" open>
        {doc.data.datasets.length > 1 && (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-ds`}>Dataset</Label>
            <Select id={`${id}-ds`} value={dataset.id} onChange={(e) => change((c) => ({ ...c, datasetId: e.target.value, columns: undefined, sort: undefined, filters: [], formats: {} }))}>
              {doc.data.datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
        )}
        <ul className="grid gap-1" aria-label="Columns shown, in order">
          {shownKeys.map((k, i) => (
            <li key={k} className="flex items-center gap-1">
              <label className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked onChange={() => change((c) => ({ ...c, columns: toggleColumn(cols, c.columns, k) }), "table:columns")} />
                <span className="truncate" title={label(k)}>{label(k)}</span>
              </label>
              <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${label(k)} left`} disabled={i === 0} onClick={() => change((c) => ({ ...c, columns: moveColumn(shownKeys, k, -1) }), "table:columns")}><ArrowUp aria-hidden="true" /></Button>
              <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${label(k)} right`} disabled={i === shownKeys.length - 1} onClick={() => change((c) => ({ ...c, columns: moveColumn(shownKeys, k, 1) }), "table:columns")}><ArrowDown aria-hidden="true" /></Button>
            </li>
          ))}
          {hidden.map((c) => (
            <li key={c.key}>
              <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={false} onChange={() => change((cur) => ({ ...cur, columns: toggleColumn(cols, cur.columns ?? shownKeys, c.key) }), "table:columns")} />
                <span className="truncate" title={c.label}>{c.label} (hidden)</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Hiding a column here never changes your data.</p>
      </Section>

      <Section title="Sorting and layout" open>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-sort`}>Sort by</Label>
          <Select id={`${id}-sort`} value={config.sort?.key ?? ""} onChange={(e) => change((c) => ({ ...c, sort: e.target.value ? { key: e.target.value, dir: c.sort?.dir ?? "asc" } : undefined }), "table:sort")}>
            <option value="">Data order</option>
            {cols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </Select>
        </div>
        {config.sort && (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-dir`}>Direction</Label>
            <Select id={`${id}-dir`} value={config.sort.dir} onChange={(e) => change((c) => ({ ...c, sort: c.sort ? { ...c.sort, dir: e.target.value as "asc" | "desc" } : c.sort }), "table:sort")}>
              <option value="asc">Smallest or A to Z first</option>
              <option value="desc">Largest or Z to A first</option>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-den`}>Row spacing</Label>
            <Select id={`${id}-den`} value={config.density} onChange={(e) => change((c) => ({ ...c, density: e.target.value as TableConfig["density"] }))}>
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-ps`}>Rows per page</Label>
            <Select id={`${id}-ps`} value={String(config.pageSize)} onChange={(e) => change((c) => ({ ...c, pageSize: Number(e.target.value) }))}>
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </div>
        </div>
      </Section>

      {view.columns.some((c) => c.type === "number") && (
        <Section title="Highlight numbers">
          <p className="text-xs text-muted-foreground">Shade a numeric column from its smallest to its largest value among the rows shown.</p>
          {view.columns.filter((c) => c.type === "number").map((c) => (
            <div key={c.key} className="grid gap-1.5">
              <Label htmlFor={`${id}-f-${c.key}`}>{c.label}</Label>
              <Select id={`${id}-f-${c.key}`} value={config.formats[c.key] ?? "none"} onChange={(e) => change((cur) => { const { [c.key]: _drop, ...rest } = cur.formats; void _drop; return { ...cur, formats: e.target.value === "none" ? rest : { ...rest, [c.key]: e.target.value as TableFormat } }; }, `table:format:${c.key}`)}>
                {(["none", "scale", "bars"] as const).map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
              </Select>
            </div>
          ))}
        </Section>
      )}

      <Section title={`Filters${config.filters.length ? ` (${config.filters.length})` : ""}`} open={config.filters.length > 0}>
        <FilterEditor noun="table" cols={cols} filters={config.filters} onChange={(fn, key) => change((c) => ({ ...c, filters: fn(c.filters) }), key ? `table:${key}` : undefined)} />
      </Section>
    </section>
  );
}
