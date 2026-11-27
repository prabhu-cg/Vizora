"use client";

import { ChevronRight, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AGGREGATIONS, AGG_LABEL, CHART_KINDS, FILTER_OPS, FILTER_OP_LABEL, KIND_META, PALETTES, TIME_BUCKETS, switchKind,
  type ChartConfig, type ChartKind, type Recommendation,
} from "@/lib/charts";
import type { ChartData } from "@/lib/charts/query";
import { cn } from "@/lib/utils/cn";
import type { Dataset } from "@/types/visualisation";
import { FALLBACK_CHART_THEME, colourFor } from "./theme";

type Change = (updater: (c: ChartConfig) => ChartConfig, coalesceKey?: string) => void;

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

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const Check = ({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) => (
  <label htmlFor={id} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm">
    <input id={id} type="checkbox" className="size-4 accent-[var(--primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    {children}
  </label>
);

/** Why the chart is what it is, with one-click alternatives. */
export function RecommendationCard({ recommendation, current, onPick }: { recommendation: Recommendation; current: ChartKind; onPick: (c: ChartConfig) => void }) {
  const same = recommendation.kind === current;
  return (
    <section aria-label="Chart recommendation" className="grid gap-3 border-b border-border bg-primary-soft/50 p-4">
      <div>
        <h3 className="text-[15px] font-semibold">{same ? "Recommended for this data" : `Recommended: ${KIND_META[recommendation.kind].label}`}</h3>
        <p className="mt-1 text-sm text-body">{recommendation.reason}</p>
        {!same && (
          <Button size="sm" variant="outline" className="mt-2" onClick={() => onPick(recommendation.config)}>
            Use {KIND_META[recommendation.kind].label.toLowerCase()}
          </Button>
        )}
      </div>
      {recommendation.alternatives.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Other good options</p>
          <ul className="flex flex-wrap gap-1.5">
            {recommendation.alternatives.map((a) => (
              <li key={a.kind}>
                <Button size="xs" variant={a.kind === current ? "primary" : "outline"} onClick={() => onPick(a.config)} title={a.reason} aria-label={`${KIND_META[a.kind].label}: ${a.reason}`}>
                  {KIND_META[a.kind].label}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * Every chart setting in one place: type, which columns play which role,
 * aggregation, titles and labels, legend, colours, sorting and filters.
 * Controlled; it never touches data.
 */
export function ChartConfigPanel({
  config, dataset, datasets, data, onChange, onDataset,
}: {
  config: ChartConfig;
  dataset?: Dataset;
  datasets: Dataset[];
  /** The last computed result, used for series names and notes. */
  data?: ChartData;
  onChange: Change;
  onDataset?: (id: string) => void;
}) {
  const id = useId();
  const cols = dataset?.columns ?? [];
  const numeric = cols.filter((c) => c.type === "number");
  const kind = config.kind;
  const numericX = kind === "scatter" || kind === "histogram";
  const needsMeasure = kind !== "histogram" && config.aggregation !== "count";
  const set = <K extends keyof ChartConfig>(k: K, v: ChartConfig[K], key?: string) => onChange((c) => ({ ...c, [k]: v }), key ?? `chart:${String(k)}`);
  const xCol = cols.find((c) => c.key === config.x);
  const seriesNames = data ? (data.points ? [...new Set(data.points.map((p) => p.series ?? ""))].filter(Boolean) : data.tree ? data.tree.map((n) => n.name) : data.series.length > 1 || kind === "pie" || kind === "donut" || kind === "funnel" ? (kind === "pie" || kind === "donut" || kind === "funnel" ? data.categories : data.series.map((s) => s.name)) : []) : [];
  const colours = colourFor(seriesNames, config, FALLBACK_CHART_THEME);

  return (
    <div className="text-sm">
      <Section title="Chart type" open>
        <div role="radiogroup" aria-label="Chart type" className="grid gap-3">
          {(["basic", "advanced"] as const).map((group) => (
            <div key={group}>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{group === "basic" ? "Basic" : "Advanced"}</p>
              <div className="flex flex-wrap gap-1.5">
                {CHART_KINDS.filter((k) => KIND_META[k].group === group).map((k) => (
                  <label key={k} title={KIND_META[k].hint} className={cn("inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3 text-xs font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring", kind === k ? "border-primary bg-accent font-semibold text-accent-foreground" : "border-border-strong bg-background hover:bg-muted")}>
                    <input type="radio" name={`${id}-kind`} className="sr-only" checked={kind === k} onChange={() => onChange((c) => switchKind(c, k), "chart:kind")} />
                    {KIND_META[k].label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{KIND_META[kind].hint}</p>
        </div>
      </Section>

      <Section title="Data" open>
        {datasets.length > 1 && onDataset && (
          <Field label="Dataset" htmlFor={`${id}-ds`}>
            <Select id={`${id}-ds`} value={dataset?.id} onChange={(e) => onDataset(e.target.value)}>
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label={kind === "scatter" ? "X axis (numeric)" : kind === "histogram" ? "Column to count (numeric)" : kind === "pie" || kind === "donut" || kind === "treemap" ? "Categories" : kind === "funnel" ? "Stages" : kind === "boxplot" ? "Group by (optional)" : "X axis (categories)"} htmlFor={`${id}-x`}>
          <Select id={`${id}-x`} value={config.x ?? ""} onChange={(e) => set("x", e.target.value || undefined, "chart:x")}>
            <option value="">Choose a column</option>
            {(numericX ? numeric : cols).map((c) => <option key={c.key} value={c.key}>{c.label} ({c.type})</option>)}
          </Select>
        </Field>

        {kind !== "histogram" && (
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-medium text-foreground">{kind === "scatter" ? "Y axis (numeric)" : "Measures (numbers to plot)"}</legend>
            {numeric.length === 0 && <p className="text-xs text-muted-foreground">This dataset has no numeric columns. Use Count, or change a column&apos;s type when importing.</p>}
            {numeric.map((c) => {
              const on = config.y.includes(c.key);
              const single = kind === "scatter" || kind === "pie" || kind === "donut" || kind === "treemap" || kind === "heatmap" || kind === "funnel" || kind === "boxplot";
              return (
                <Check key={c.key} id={`${id}-y-${c.key}`} checked={on} onChange={(v) => onChange((cur) => ({ ...cur, y: single ? (v ? [c.key] : []) : v ? [...cur.y, c.key] : cur.y.filter((k) => k !== c.key) }), "chart:y")}>
                  {c.label}
                </Check>
              );
            })}
          </fieldset>
        )}

        {kind === "combo" && config.y.length >= 2 && (
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-medium text-foreground">Draw as a line</legend>
            <p className="mb-1 text-xs text-muted-foreground">The rest are bars. With none ticked, the last measure is the line.</p>
            {config.y.map((k) => {
              const label = cols.find((c) => c.key === k)?.label ?? k;
              return (
                <Check key={k} id={`${id}-line-${k}`} checked={config.lines.includes(k)} onChange={(v) => onChange((cur) => ({ ...cur, lines: v ? [...cur.lines, k] : cur.lines.filter((x) => x !== k) }), "chart:lines")}>
                  {label}
                </Check>
              );
            })}
            <Check id={`${id}-secondary`} checked={config.secondaryAxis} onChange={(v) => set("secondaryAxis", v)}>Use a second axis on the right for lines</Check>
          </fieldset>
        )}

        {kind !== "histogram" && kind !== "pie" && kind !== "donut" && kind !== "funnel" && kind !== "boxplot" && (
          <Field label={kind === "heatmap" ? "Second axis (categories)" : "Series (split by)"} htmlFor={`${id}-s`} hint={kind === "heatmap" ? "Becomes the vertical axis." : "Optional. Splits the measure into one series per value."}>
            <Select id={`${id}-s`} value={config.series ?? ""} onChange={(e) => set("series", e.target.value || undefined, "chart:series")}>
              <option value="">None</option>
              {cols.filter((c) => c.type !== "number" && c.key !== config.x).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </Field>
        )}

        {kind !== "scatter" && kind !== "histogram" && kind !== "boxplot" && (
          <Field label="Aggregation" htmlFor={`${id}-a`} hint={config.aggregation === "count" ? "Counts rows in each group." : needsMeasure ? "How rows in the same group combine." : undefined}>
            <Select id={`${id}-a`} value={config.aggregation} onChange={(e) => set("aggregation", e.target.value as ChartConfig["aggregation"], "chart:agg")}>
              {AGGREGATIONS.map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
            </Select>
          </Field>
        )}
        {xCol?.type === "date" && kind !== "scatter" && kind !== "histogram" && (
          <Field label="Group dates by" htmlFor={`${id}-t`}>
            <Select id={`${id}-t`} value={config.timeBucket} onChange={(e) => set("timeBucket", e.target.value as ChartConfig["timeBucket"], "chart:bucket")}>
              {TIME_BUCKETS.map((b) => <option key={b} value={b}>{b === "none" ? "Exact date" : b[0]!.toUpperCase() + b.slice(1)}</option>)}
            </Select>
          </Field>
        )}
        {kind === "histogram" && (
          <Field label="Number of bins" htmlFor={`${id}-bins`} hint="Leave empty to choose automatically.">
            <Input id={`${id}-bins`} type="number" min={2} max={60} value={config.bins ?? ""} onChange={(e) => set("bins", e.target.value ? Math.max(2, Math.min(60, Math.round(Number(e.target.value)))) : undefined, "chart:bins")} />
          </Field>
        )}
      </Section>

      <Section title="Titles and labels">
        <Field label="Chart title" htmlFor={`${id}-title`}>
          <Input id={`${id}-title`} value={config.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Subtitle" htmlFor={`${id}-sub`}>
          <Input id={`${id}-sub`} value={config.subtitle} maxLength={300} onChange={(e) => set("subtitle", e.target.value)} />
        </Field>
        {kind !== "pie" && kind !== "donut" && kind !== "treemap" && (
          <>
            <Field label="X axis label" htmlFor={`${id}-xl`} hint={data ? `Leave empty to use “${data.xLabel}”.` : undefined}>
              <Input id={`${id}-xl`} value={config.xLabel ?? ""} maxLength={100} onChange={(e) => set("xLabel", e.target.value || undefined, "chart:xLabel")} />
            </Field>
            <Field label="Y axis label" htmlFor={`${id}-yl`} hint={data ? `Leave empty to use “${data.yLabel}”.` : undefined}>
              <Input id={`${id}-yl`} value={config.yLabel ?? ""} maxLength={100} onChange={(e) => set("yLabel", e.target.value || undefined, "chart:yLabel")} />
            </Field>
          </>
        )}
      </Section>

      <Section title="Appearance">
        <Check id={`${id}-legend`} checked={config.legend.show} onChange={(v) => onChange((c) => ({ ...c, legend: { ...c.legend, show: v } }))}>Show legend</Check>
        {config.legend.show && (
          <Field label="Legend position" htmlFor={`${id}-lp`}>
            <Select id={`${id}-lp`} value={config.legend.position} onChange={(e) => onChange((c) => ({ ...c, legend: { ...c.legend, position: e.target.value as ChartConfig["legend"]["position"] } }))}>
              {["top", "bottom", "left", "right"].map((p) => <option key={p} value={p}>{p[0]!.toUpperCase() + p.slice(1)}</option>)}
            </Select>
          </Field>
        )}
        <Check id={`${id}-dl`} checked={config.dataLabels} onChange={(v) => set("dataLabels", v)}>Show values on the chart</Check>
        <Check id={`${id}-tt`} checked={config.tooltips} onChange={(v) => set("tooltips", v)}>Show tooltips on hover</Check>
        {(kind === "line" || kind === "area" || kind === "multi-line") && <Check id={`${id}-sm`} checked={config.smooth} onChange={(v) => set("smooth", v)}>Smooth lines</Check>}
        <Field label="Colour palette" htmlFor={`${id}-pal`} hint={PALETTES[config.palette]?.note}>
          <Select id={`${id}-pal`} value={config.palette} onChange={(e) => set("palette", e.target.value, "chart:palette")}>
            {Object.entries(PALETTES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </Select>
        </Field>
        {seriesNames.length > 0 && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium text-foreground">Individual colours</legend>
            {seriesNames.slice(0, 12).map((name, i) => (
              <div key={name} className="flex items-center gap-2">
                <input type="color" aria-label={`Colour for ${name}`} value={colours[i]!.startsWith("#") && colours[i]!.length === 7 ? colours[i] : FALLBACK_CHART_THEME.series[0]} onChange={(e) => onChange((c) => ({ ...c, colors: { ...c.colors, [name]: e.target.value } }), `chart:color:${name}`)} className="size-8 cursor-pointer rounded border border-border-strong bg-transparent p-0.5" />
                <span className="min-w-0 flex-1 truncate" title={name}>{name}</span>
                {config.colors[name] && (
                  <Button variant="ghost" size="icon" className="size-8" aria-label={`Reset colour for ${name}`} onClick={() => onChange((c) => { const { [name]: _drop, ...rest } = c.colors; void _drop; return { ...c, colors: rest }; })}>
                    <RotateCcw aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
            {seriesNames.length > 12 && <p className="text-xs text-muted-foreground">Showing the first 12.</p>}
          </fieldset>
        )}
      </Section>

      {kind !== "scatter" && kind !== "histogram" && kind !== "heatmap" && (
        <Section title="Sorting and limits">
          <Field label="Sort by" htmlFor={`${id}-sb`}>
            <Select id={`${id}-sb`} value={config.sort.by} onChange={(e) => onChange((c) => ({ ...c, sort: { ...c.sort, by: e.target.value as ChartConfig["sort"]["by"] } }), "chart:sortBy")}>
              <option value="none">Data order</option>
              <option value="value">Value</option>
              <option value="label">Label</option>
            </Select>
          </Field>
          {config.sort.by !== "none" && (
            <Field label="Direction" htmlFor={`${id}-sd`}>
              <Select id={`${id}-sd`} value={config.sort.dir} onChange={(e) => onChange((c) => ({ ...c, sort: { ...c.sort, dir: e.target.value as "asc" | "desc" } }))}>
                <option value="desc">{config.sort.by === "label" ? "Z to A" : "Largest first"}</option>
                <option value="asc">{config.sort.by === "label" ? "A to Z" : "Smallest first"}</option>
              </Select>
            </Field>
          )}
          <Field label="Show only the top…" htmlFor={`${id}-lim`} hint="Ranks by value. Leave empty to show every category.">
            <Input id={`${id}-lim`} type="number" min={1} max={500} value={config.limit ?? ""} onChange={(e) => set("limit", e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : undefined, "chart:limit")} />
          </Field>
          {config.limit && (config.aggregation === "sum" || config.aggregation === "count") && <Check id={`${id}-oth`} checked={config.groupOthers} onChange={(v) => set("groupOthers", v)}>Group the rest as “Other”</Check>}
        </Section>
      )}

      <Section title={`Filters${config.filters.length ? ` (${config.filters.length})` : ""}`} open={config.filters.length > 0}>
        {config.filters.length === 0 && <p className="text-xs text-muted-foreground">Show only some rows. Filters affect this chart, never your data.</p>}
        <ul className="grid gap-3">
          {config.filters.map((f, i) => {
            const col = cols.find((c) => c.key === f.column);
            const noValue = f.op === "empty" || f.op === "notEmpty";
            return (
              <li key={i} className="grid gap-1.5 rounded-input border border-border p-2.5">
                <Select aria-label={`Filter ${i + 1} column`} value={f.column} onChange={(e) => onChange((c) => ({ ...c, filters: c.filters.map((x, j) => (j === i ? { ...x, column: e.target.value } : x)) }))} className="h-9">
                  {cols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </Select>
                <Select aria-label={`Filter ${i + 1} condition`} value={f.op} onChange={(e) => onChange((c) => ({ ...c, filters: c.filters.map((x, j) => (j === i ? { ...x, op: e.target.value as typeof f.op } : x)) }))} className="h-9">
                  {FILTER_OPS.map((o) => <option key={o} value={o}>{FILTER_OP_LABEL[o]}</option>)}
                </Select>
                {!noValue && <Input aria-label={`Filter ${i + 1} value`} value={f.value} placeholder={f.op === "in" ? "a, b, c" : col?.type === "date" ? "2026-01-31" : "value"} onChange={(e) => onChange((c) => ({ ...c, filters: c.filters.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) }), `chart:filter:${i}`)} className="h-9" />}
                <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => onChange((c) => ({ ...c, filters: c.filters.filter((_, j) => j !== i) }))} aria-label={`Remove filter ${i + 1}`}><Trash2 aria-hidden="true" /> Remove</Button>
              </li>
            );
          })}
        </ul>
        <Button variant="outline" size="sm" disabled={cols.length === 0 || config.filters.length >= 20} onClick={() => onChange((c) => ({ ...c, filters: [...c.filters, { column: cols[0]!.key, op: "eq", value: "" }] }))}>
          <Plus aria-hidden="true" /> Add filter
        </Button>
      </Section>
    </div>
  );
}
