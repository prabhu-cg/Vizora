import { sortKeyOf } from "@/lib/engine/interpret/dates";
import type { Cell, Column, Dataset } from "@/types/visualisation";
import { AGG_LABEL, CATEGORY_KINDS, type Aggregation, type ChartConfig, type ChartFilter } from "./config";

export interface TreeNode {
  name: string;
  value: number;
  children?: TreeNode[];
}

export interface ChartData {
  kind: ChartConfig["kind"];
  categories: string[];
  series: { name: string; values: (number | null)[] }[];
  points?: { x: number; y: number; series?: string }[];
  matrix?: { xs: string[]; ys: string[]; cells: [number, number, number][]; min: number; max: number };
  tree?: TreeNode[];
  /** Box plot: five-number summary per group, plus the points beyond the whiskers. */
  box?: { stats: [number, number, number, number, number][]; counts: number[]; outliers: [number, number][] };
  /** Number tile: the headline value and, with a date column, the change from the previous period. */
  kpi?: { value: number | null; label: string; previous?: number | null; change?: number; period?: string; previousPeriod?: string };
  /** Gantt: scheduled tasks, earliest first, and the groups used for colour. */
  gantt?: { tasks: { name: string; start: number; end: number; group?: string }[]; groups: string[]; min: number; max: number };
  /** Suggested axis titles, used when the config does not set its own. */
  xLabel: string;
  yLabel: string;
  /** Plain-language remarks: rows excluded, results truncated, and so on. */
  notes: string[];
  /** How many source rows contributed after filtering. */
  rowsUsed: number;
  rowsTotal: number;
}

export type QueryResult = { ok: true; data: ChartData } | { ok: false; error: string };

const BLANK = "(blank)";

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");
  return `${n}${suffix}`;
}

const MAX_POINTS = 5000;
/** The most categories each chart kind draws when no limit is set; beyond it the largest are kept, with a note. */
export const CATEGORY_CAP: Record<ChartConfig["kind"], number> = {
  pie: 30, donut: 30, bar: 150, hbar: 60, "stacked-bar": 100, "grouped-bar": 100, line: 5000, area: 5000, "multi-line": 5000, treemap: 300, heatmap: 50, scatter: 5000, histogram: 5000,
  "stacked-100": 100, combo: 100, boxplot: 30, funnel: 12, kpi: 1, gantt: 60,
};
const MAX_HEATMAP = 50;

type Row = Record<string, Cell>;

function compare(a: Cell, b: Cell, type: Column["type"]): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  if (type === "number") return (a as number) - (b as number);
  if (type === "date") {
    const ka = sortKeyOf(String(a)), kb = sortKeyOf(String(b));
    if (ka !== undefined && kb !== undefined) return ka - kb;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function matches(cell: Cell, col: Column, f: ChartFilter): boolean {
  if (f.op === "empty") return cell === null || cell === "";
  if (f.op === "notEmpty") return cell !== null && cell !== "";
  if (cell === null) return f.op === "neq";
  const needle = f.value.trim();
  const asNum = col.type === "number" ? Number(needle) : undefined;
  switch (f.op) {
    case "eq":
      return col.type === "number" ? cell === asNum : String(cell).toLowerCase() === needle.toLowerCase();
    case "neq":
      return col.type === "number" ? cell !== asNum : String(cell).toLowerCase() !== needle.toLowerCase();
    case "contains":
      return String(cell).toLowerCase().includes(needle.toLowerCase());
    case "in":
      return needle.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).includes(String(cell).toLowerCase());
    case "gt": case "gte": case "lt": case "lte": {
      if (col.type === "number" && Number.isNaN(asNum)) return true; // an unfinished filter should not hide everything
      const c = col.type === "number" ? (cell as number) - asNum! : compare(cell, needle, col.type);
      return f.op === "gt" ? c > 0 : f.op === "gte" ? c >= 0 : f.op === "lt" ? c < 0 : c <= 0;
    }
  }
}

/** Rows that pass every filter. Filters naming a column that no longer exists are ignored. */
export function applyFilters(dataset: Pick<Dataset, "columns" | "rows">, filters: readonly ChartFilter[]): Row[] {
  const active = filters.map((f) => ({ f, col: dataset.columns.find((c) => c.key === f.column) })).filter((x): x is { f: ChartFilter; col: Column } => !!x.col);
  return active.length ? dataset.rows.filter((r) => active.every(({ f, col }) => matches(r[col.key] ?? null, col, f))) : dataset.rows;
}

function bucket(cell: Cell, col: Column, by: ChartConfig["timeBucket"]): string {
  if (cell === null || cell === "") return BLANK;
  if (col.type === "date" && by !== "none") {
    const s = String(cell);
    const m = /^(\d{4})(?:-(\d{2}))?/.exec(s);
    if (m) return by === "year" ? m[1]! : by === "month" ? (m[2] ? `${m[1]}-${m[2]}` : m[1]!) : s.slice(0, 10);
  }
  return String(cell);
}

class Acc {
  sum = 0;
  n = 0;
  rows = 0;
  min = Infinity;
  max = -Infinity;
  add(v: number | null) {
    this.rows++;
    if (v === null) return;
    this.n++;
    this.sum += v;
    if (v < this.min) this.min = v;
    if (v > this.max) this.max = v;
  }
  result(a: Aggregation): number | null {
    if (a === "count") return this.rows;
    if (this.n === 0) return null;
    return a === "sum" ? this.sum : a === "avg" ? this.sum / this.n : a === "min" ? this.min : this.max;
  }
}

const num = (c: Cell): number | null => (typeof c === "number" && Number.isFinite(c) ? c : null);

/** Order categories chronologically for dates and numerically for numbers; otherwise first appearance. */
function orderKeys(keys: string[], col: Column): string[] {
  if (col.type === "date") {
    return [...keys].sort((a, b) => (a === BLANK ? 1 : b === BLANK ? -1 : (sortKeyOf(a) ?? Infinity) - (sortKeyOf(b) ?? Infinity) || a.localeCompare(b)));
  }
  if (col.type === "number") return [...keys].sort((a, b) => (a === BLANK ? 1 : b === BLANK ? -1 : Number(a) - Number(b)));
  return keys;
}

const measureLabel = (config: ChartConfig, col?: Column) => (config.aggregation === "count" || !col ? "Count" : `${AGG_LABEL[config.aggregation]} of ${col.label}`);

/**
 * Compute exactly what a chart will show, from the dataset and its
 * configuration. Pure and deterministic: tests check these numbers against
 * hand-calculated values. Every exclusion is reported in `notes`.
 */
export function runChartQuery(dataset: Pick<Dataset, "columns" | "rows">, config: ChartConfig): QueryResult {
  const col = (key: string | undefined) => (key ? dataset.columns.find((c) => c.key === key) : undefined);
  const fail = (error: string): QueryResult => ({ ok: false, error });
  const notes: string[] = [];

  for (const k of [config.x, config.series, ...config.y]) {
    if (k && !col(k)) return fail(`The column “${k}” is no longer in this dataset. Choose another.`);
  }
  const rows = applyFilters(dataset, config.filters);
  if (rows.length < dataset.rows.length) notes.push(`${dataset.rows.length - rows.length} row${dataset.rows.length - rows.length === 1 ? " is" : "s are"} hidden by filters.`);
  if (rows.length === 0) return fail(dataset.rows.length ? "No rows match the filters. Relax them to see data." : "This dataset has no rows.");

  const xCol = col(config.x);
  const yCols = config.y.map((k) => col(k)!).filter(Boolean);
  const serCol = col(config.series);
  const agg = config.aggregation;
  const base = { kind: config.kind, rowsUsed: rows.length, rowsTotal: dataset.rows.length, notes };

  // ── Scatter ───────────────────────────────────────────────────────────────
  if (config.kind === "scatter") {
    const yc = yCols[0];
    if (!xCol || xCol.type !== "number") return fail("A scatter plot needs a numeric column for X. Choose one.");
    if (!yc || yc.type !== "number") return fail("A scatter plot needs a numeric column for Y. Choose one.");
    let pts = rows.flatMap((r) => {
      const x = num(r[xCol.key] ?? null), y = num(r[yc.key] ?? null);
      return x === null || y === null ? [] : [{ x, y, series: serCol ? bucket(r[serCol.key] ?? null, serCol, "none") : undefined }];
    });
    const dropped = rows.length - pts.length;
    if (dropped) notes.push(`${dropped} row${dropped === 1 ? " has" : "s have"} a missing X or Y and ${dropped === 1 ? "is" : "are"} not plotted.`);
    if (pts.length > MAX_POINTS) {
      const step = Math.ceil(pts.length / MAX_POINTS);
      notes.push(`Showing every ${ordinal(step)} of ${pts.length.toLocaleString()} points to keep the chart responsive.`);
      pts = pts.filter((_, i) => i % step === 0);
    }
    if (!pts.length) return fail("No rows have numbers in both columns.");
    return { ok: true, data: { ...base, categories: [], series: [], points: pts, xLabel: xCol.label, yLabel: yc.label } };
  }

  // ── Histogram ─────────────────────────────────────────────────────────────
  if (config.kind === "histogram") {
    if (!xCol || xCol.type !== "number") return fail("A histogram needs a numeric column. Choose one for X.");
    const vals = rows.map((r) => num(r[xCol.key] ?? null)).filter((v): v is number => v !== null);
    const missing = rows.length - vals.length;
    if (missing) notes.push(`${missing} row${missing === 1 ? " has" : "s have"} no value and ${missing === 1 ? "is" : "are"} not counted.`);
    if (!vals.length) return fail("This column has no numbers to count.");
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const k = hi === lo ? 1 : (config.bins ?? Math.min(30, Math.max(5, Math.ceil(Math.log2(vals.length)) + 1)));
    const width = hi === lo ? 1 : (hi - lo) / k;
    const counts = new Array<number>(k).fill(0);
    for (const v of vals) counts[Math.min(k - 1, Math.floor((v - lo) / width))]!++;
    const fmt = (n: number) => String(Math.round(n * 1000) / 1000);
    const categories = counts.map((_, i) => (hi === lo ? fmt(lo) : `${fmt(lo + i * width)}–${fmt(lo + (i + 1) * width)}`));
    return { ok: true, data: { ...base, categories, series: [{ name: "Count", values: counts }], xLabel: xCol.label, yLabel: "Count" } };
  }

  // ── Heatmap ───────────────────────────────────────────────────────────────
  if (config.kind === "heatmap") {
    if (!xCol) return fail("A heatmap needs a categorical column for X.");
    if (!serCol) return fail("A heatmap needs a second categorical column. Choose one for Series (it becomes the other axis).");
    const yc = yCols[0];
    if (agg !== "count" && (!yc || yc.type !== "number")) return fail("Choose a numeric measure for the heatmap, or set the aggregation to Count.");
    const cells = new Map<string, Acc>();
    const xk: string[] = [], yk: string[] = [];
    for (const r of rows) {
      const a = bucket(r[xCol.key] ?? null, xCol, config.timeBucket), b = bucket(r[serCol.key] ?? null, serCol, "none");
      if (!xk.includes(a)) xk.push(a);
      if (!yk.includes(b)) yk.push(b);
      const key = `${a}\u0000${b}`;
      (cells.get(key) ?? cells.set(key, new Acc()).get(key)!).add(yc ? num(r[yc.key] ?? null) : null);
    }
    let xs = orderKeys(xk, xCol), ys = orderKeys(yk, serCol);
    if (xs.length > MAX_HEATMAP || ys.length > MAX_HEATMAP) notes.push(`Showing the first ${MAX_HEATMAP} of ${xs.length} × ${ys.length} categories.`);
    xs = xs.slice(0, MAX_HEATMAP);
    ys = ys.slice(0, MAX_HEATMAP);
    const out: [number, number, number][] = [];
    cells.forEach((acc, key) => {
      const [a, b] = key.split("\u0000") as [string, string];
      const v = acc.result(agg);
      const xi = xs.indexOf(a), yi = ys.indexOf(b);
      if (v !== null && xi >= 0 && yi >= 0) out.push([xi, yi, v]);
    });
    if (!out.length) return fail("There are no values to show for this combination.");
    const values = out.map((c) => c[2]);
    return { ok: true, data: { ...base, categories: xs, series: [], matrix: { xs, ys, cells: out, min: Math.min(...values), max: Math.max(...values) }, xLabel: xCol.label, yLabel: serCol.label } };
  }

  // ── Number tile ───────────────────────────────────────────────────────────
  if (config.kind === "kpi") {
    const yc = yCols[0];
    if (agg !== "count" && (!yc || yc.type !== "number")) return fail("A number tile needs a numeric column to measure, or set the aggregation to Count.");
    const aggregate = (rs: Row[]) => {
      const a = new Acc();
      for (const r of rs) a.add(yc ? num(r[yc.key] ?? null) : null);
      return a.result(agg);
    };
    const label = measureLabel(config, yc);
    if (!xCol) return { ok: true, data: { ...base, categories: [], series: [], kpi: { value: aggregate(rows), label }, xLabel: "", yLabel: label } };
    if (xCol.type !== "date") return fail("Compare by needs a date column. Choose one, or clear it to show the overall figure.");
    const by = config.timeBucket === "none" ? "month" : config.timeBucket;
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const k = bucket(r[xCol.key] ?? null, xCol, by);
      if (k === BLANK) continue;
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
    }
    const keys = orderKeys([...groups.keys()], xCol);
    if (!keys.length) return fail("This date column has no dates to compare.");
    const period = keys[keys.length - 1]!, previousPeriod = keys[keys.length - 2];
    const value = aggregate(groups.get(period)!);
    const previous = previousPeriod ? aggregate(groups.get(previousPeriod)!) : undefined;
    const change = value !== null && previous !== undefined && previous !== null && previous !== 0 ? (value - previous) / Math.abs(previous) : undefined;
    notes.push(previousPeriod ? `Latest ${by} is ${period}, compared with ${previousPeriod}.` : `Only one ${by} (${period}) is in the data, so there is nothing to compare it with.`);
    return { ok: true, data: { ...base, categories: [], series: [], kpi: { value, label, previous, change, period, previousPeriod }, xLabel: xCol.label, yLabel: label } };
  }

  // ── Gantt ─────────────────────────────────────────────────────────────────
  if (config.kind === "gantt") {
    const [sc, ec] = yCols;
    if (!xCol) return fail("Choose the column that names each task.");
    if (!sc || !ec || sc.type !== "date" || ec.type !== "date") return fail("A Gantt chart needs a start date column and an end date column. Choose both under Start and End.");
    const parse = (c: Cell) => {
      const t = c === null || c === "" ? NaN : Date.parse(String(c));
      return Number.isFinite(t) ? t : null;
    };
    let tasks: { name: string; start: number; end: number; group?: string }[] = [];
    let missing = 0, backwards = 0;
    for (const r of rows) {
      const start = parse(r[sc.key] ?? null), end = parse(r[ec.key] ?? null);
      if (start === null || end === null) { missing++; continue; }
      if (end < start) { backwards++; continue; }
      tasks.push({ name: String(r[xCol.key] ?? BLANK) || BLANK, start, end, group: serCol ? bucket(r[serCol.key] ?? null, serCol, "none") : undefined });
    }
    if (missing) notes.push(`${missing} row${missing === 1 ? " is" : "s are"} missing a start or end date and ${missing === 1 ? "is" : "are"} not shown.`);
    if (backwards) notes.push(`${backwards} row${backwards === 1 ? " ends" : "s end"} before ${backwards === 1 ? "it starts" : "they start"} and ${backwards === 1 ? "is" : "are"} not shown.`);
    if (!tasks.length) return fail("No rows have both a valid start and end date.");
    tasks.sort((a, b) => a.start - b.start || a.end - b.end);
    const cap = config.limit ?? CATEGORY_CAP.gantt;
    if (tasks.length > cap) {
      notes.push(config.limit ? `Showing the first ${cap} of ${tasks.length} tasks by start date.` : `Showing the first ${cap} of ${tasks.length.toLocaleString()} tasks by start date to keep the chart readable. Use a filter to narrow it.`);
      tasks = tasks.slice(0, cap);
    }
    const groups = serCol ? [...new Set(tasks.map((t) => t.group!))] : [];
    return { ok: true, data: { ...base, categories: tasks.map((t) => t.name), series: [], gantt: { tasks, groups, min: Math.min(...tasks.map((t) => t.start)), max: Math.max(...tasks.map((t) => t.end)) }, xLabel: xCol.label, yLabel: "" } };
  }

  // ── Box plot ──────────────────────────────────────────────────────────────
  if (config.kind === "boxplot") {
    const yc = yCols[0];
    if (!yc || yc.type !== "number") return fail("A box plot needs a numeric column to summarise. Choose one under Measures.");
    const groups = new Map<string, number[]>();
    let empty = 0;
    for (const r of rows) {
      const v = num(r[yc.key] ?? null);
      if (v === null) { empty++; continue; }
      const g = xCol ? bucket(r[xCol.key] ?? null, xCol, config.timeBucket) : yc.label;
      (groups.get(g) ?? groups.set(g, []).get(g)!).push(v);
    }
    if (empty) notes.push(`${empty} row${empty === 1 ? " has" : "s have"} no value and ${empty === 1 ? "is" : "are"} not counted.`);
    if (!groups.size) return fail("This column has no numbers to summarise.");
    let keys = xCol ? orderKeys([...groups.keys()], xCol) : [...groups.keys()];
    const cap = config.limit ?? CATEGORY_CAP.boxplot;
    if (keys.length > cap) {
      notes.push(config.limit ? `Showing the ${cap} groups with the most rows of ${keys.length}.` : `Showing the ${cap} groups with the most rows of ${keys.length.toLocaleString()} to keep the chart readable. Change this under Sorting and limits.`);
      const keep = new Set([...keys].sort((a, b) => groups.get(b)!.length - groups.get(a)!.length).slice(0, cap));
      keys = keys.filter((k) => keep.has(k));
    }
    const quantile = (sorted: number[], p: number) => {
      const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
      return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
    };
    const stats: [number, number, number, number, number][] = [];
    const counts: number[] = [];
    const outliers: [number, number][] = [];
    keys.forEach((k, gi) => {
      const sorted = [...groups.get(k)!].sort((a, b) => a - b);
      const q1 = quantile(sorted, 0.25), med = quantile(sorted, 0.5), q3 = quantile(sorted, 0.75);
      const fence = 1.5 * (q3 - q1);
      const inside = sorted.filter((v) => v >= q1 - fence && v <= q3 + fence);
      stats.push([inside[0] ?? sorted[0]!, q1, med, q3, inside[inside.length - 1] ?? sorted[sorted.length - 1]!]);
      counts.push(sorted.length);
      for (const v of sorted) if (v < q1 - fence || v > q3 + fence) outliers.push([gi, v]);
    });
    if (outliers.length > 2000) {
      notes.push(`${outliers.length.toLocaleString()} outliers; the most extreme 2,000 are drawn.`);
      outliers.sort((a, b) => Math.abs(b[1] - stats[b[0]]![2]) - Math.abs(a[1] - stats[a[0]]![2]));
      outliers.length = 2000;
    }
    return { ok: true, data: { ...base, categories: keys, series: [], box: { stats, counts, outliers }, xLabel: xCol?.label ?? "", yLabel: yc.label } };
  }

  // ── Category charts ───────────────────────────────────────────────────────
  if (!(CATEGORY_KINDS as readonly string[]).includes(config.kind)) return fail("This chart type is not supported yet.");
  if (!xCol) return fail("Choose a column for the X axis (the categories).");
  if (agg !== "count" && yCols.length === 0) return fail("Choose a numeric column to measure, or set the aggregation to Count.");
  const badMeasure = yCols.find((c) => c.type !== "number");
  if (agg !== "count" && badMeasure) return fail(`“${badMeasure.label}” is not numeric, so it cannot be ${agg === "sum" ? "added up" : agg === "avg" ? "averaged" : `used for its ${agg === "min" ? "minimum" : "maximum"}`}. Choose a numeric column or use Count.`);

  const measureCols: (Column | undefined)[] = agg === "count" ? [yCols[0]] : yCols;
  const oneMeasure = config.kind === "pie" || config.kind === "donut" || config.kind === "funnel";
  const splitBySeries = !!serCol && !oneMeasure;
  const useCols = splitBySeries || oneMeasure ? measureCols.slice(0, 1) : measureCols;
  if (oneMeasure && measureCols.length > 1) notes.push(`A ${config.kind === "pie" ? "pie" : config.kind === "donut" ? "donut" : "funnel"} shows one measure; “${measureCols[0]?.label}” is used.`);
  if (splitBySeries && measureCols.length > 1) notes.push(`With a Series column, one measure is shown; “${measureCols[0]?.label}” is used.`);

  const seriesNames = splitBySeries ? [] as string[] : useCols.map((c) => measureLabel(config, c));
  const accs = new Map<string, Map<string, Acc>>(); // category → series → acc
  const catKeys: string[] = [];
  const serKeys: string[] = [];
  let nullMeasures = 0;
  for (const r of rows) {
    const cat = bucket(r[xCol.key] ?? null, xCol, config.timeBucket);
    if (!accs.has(cat)) {
      accs.set(cat, new Map());
      catKeys.push(cat);
    }
    const m = accs.get(cat)!;
    if (splitBySeries) {
      const s = bucket(r[serCol!.key] ?? null, serCol!, "none");
      if (!serKeys.includes(s)) serKeys.push(s);
      const v = useCols[0] ? num(r[useCols[0].key] ?? null) : null;
      if (useCols[0] && v === null && agg !== "count") nullMeasures++;
      (m.get(s) ?? m.set(s, new Acc()).get(s)!).add(v);
    } else {
      useCols.forEach((c, i) => {
        const v = c ? num(r[c.key] ?? null) : null;
        if (c && v === null && agg !== "count") nullMeasures++;
        (m.get(String(i)) ?? m.set(String(i), new Acc()).get(String(i))!).add(v);
      });
      if (useCols.length === 0) (m.get("0") ?? m.set("0", new Acc()).get("0")!).add(null);
    }
  }
  if (nullMeasures) notes.push(`${nullMeasures} empty value${nullMeasures === 1 ? " was" : "s were"} ignored when calculating.`);

  const seriesKeys = splitBySeries ? orderKeys(serKeys, serCol!) : (useCols.length ? useCols.map((_, i) => String(i)) : ["0"]);
  const names = splitBySeries ? seriesKeys : seriesNames.length ? seriesNames : ["Count"];
  let cats = orderKeys(catKeys, xCol);
  let table = cats.map((c) => seriesKeys.map((s) => accs.get(c)!.get(s)?.result(agg) ?? null));

  // Sorting, then Top N. With no explicit limit, categories beyond what a chart can show legibly
  // (and draw quickly) are cut to the largest ones, and the note says so.
  const total = (i: number) => table[i]!.reduce<number>((a, v) => a + (v ?? 0), 0);
  const autoCap = config.limit === undefined && xCol.type !== "date" ? CATEGORY_CAP[config.kind] : undefined;
  const effectiveLimit = config.limit ?? (autoCap !== undefined && cats.length > autoCap ? autoCap : undefined);
  const autoLimited = config.limit === undefined && effectiveLimit !== undefined;
  let order = cats.map((_, i) => i);
  if (config.sort.by === "value") order.sort((a, b) => (config.sort.dir === "asc" ? total(a) - total(b) : total(b) - total(a)));
  else if (config.sort.by === "label") order.sort((a, b) => compare(cats[a]!, cats[b]!, xCol.type === "number" ? "number" : "string") * (config.sort.dir === "asc" ? 1 : -1));
  else if (config.kind === "funnel") order.sort((a, b) => total(b) - total(a)); // a funnel reads from largest to smallest
  else if (effectiveLimit && effectiveLimit < order.length) order.sort((a, b) => total(b) - total(a)); // "top N" implies ranking by value
  if (effectiveLimit && order.length > effectiveLimit) {
    const kept = order.slice(0, effectiveLimit);
    const rest = order.slice(effectiveLimit);
    const canMerge = config.groupOthers && (agg === "sum" || agg === "count");
    if (canMerge) {
      const other = seriesKeys.map((_, s) => rest.reduce<number | null>((a, i) => (table[i]![s] === null ? a : (a ?? 0) + table[i]![s]!), null));
      cats = [...kept.map((i) => cats[i]!), "Other"];
      table = [...kept.map((i) => table[i]!), other];
      notes.push(`${rest.length} smaller categor${rest.length === 1 ? "y is" : "ies are"} grouped as “Other”.`);
      order = cats.map((_, i) => i);
    } else {
      notes.push(autoLimited ? `Showing the largest ${effectiveLimit} of ${order.length.toLocaleString()} categories to keep the chart readable. Change this under Sorting and limits.` : `Showing the top ${config.limit} of ${order.length} categories.`);
      cats = kept.map((i) => cats[i]!);
      table = kept.map((i) => table[i]!);
      order = cats.map((_, i) => i);
    }
  } else {
    cats = order.map((i) => cats[i]!);
    table = order.map((i) => table[i]!);
  }

  const series = names.map((name, s) => ({ name, values: table.map((row) => row[s] ?? null) }));
  const xLabel = xCol.label;
  const yLabel = splitBySeries ? measureLabel(config, useCols[0]) : useCols.length === 1 || useCols.length === 0 ? measureLabel(config, useCols[0]) : AGG_LABEL[agg];

  let tree: TreeNode[] | undefined;
  if (config.kind === "treemap") {
    tree = cats.map((c, i) => {
      if (splitBySeries) {
        const kids = seriesKeys.map((s, si) => ({ name: s, value: table[i]![si] ?? 0 })).filter((k) => k.value > 0);
        return { name: c, value: kids.reduce((a, k) => a + k.value, 0), children: kids };
      }
      return { name: c, value: table[i]![0] ?? 0 };
    }).filter((n) => n.value > 0);
    const neg = series.flatMap((s) => s.values).filter((v) => v !== null && v < 0).length;
    if (neg) notes.push(`${neg} negative value${neg === 1 ? "" : "s"} cannot be drawn in a treemap and ${neg === 1 ? "is" : "are"} left out.`);
    if (!tree.length) return fail("A treemap needs positive values. This selection has none.");
  }
  if ((config.kind === "pie" || config.kind === "donut") && series[0]!.values.some((v) => v !== null && v < 0)) {
    notes.push("Negative values cannot be shown as parts of a whole and are left out.");
  }
  if (config.kind === "multi-line" && series.length < 2) notes.push("A multi-series line needs two or more series. Add another measure or a Series column.");

  return { ok: true, data: { ...base, categories: cats, series, tree, xLabel, yLabel } };
}

/** The aggregated table behind a chart, as rows ready for display or CSV. */
export function chartTable(d: ChartData): { headers: string[]; rows: (string | number | null)[][] } {
  if (d.points) return { headers: [d.xLabel, d.yLabel, ...(d.points.some((p) => p.series) ? ["Series"] : [])], rows: d.points.map((p) => [p.x, p.y, ...(d.points!.some((q) => q.series) ? [p.series ?? ""] : [])]) };
  if (d.kpi) return { headers: ["Measure", "Value", ...(d.kpi.period ? ["Period", "Previous value", "Change (%)"] : [])], rows: [[d.kpi.label, d.kpi.value, ...(d.kpi.period ? [d.kpi.period, d.kpi.previous ?? null, d.kpi.change === undefined ? null : Math.round(d.kpi.change * 1000) / 10] : [])]] };
  if (d.gantt) return { headers: ["Task", "Start", "End", "Days", ...(d.gantt.groups.length ? ["Group"] : [])], rows: d.gantt.tasks.map((t) => [t.name, new Date(t.start).toISOString().slice(0, 10), new Date(t.end).toISOString().slice(0, 10), Math.round((t.end - t.start) / 864e5), ...(d.gantt!.groups.length ? [t.group ?? ""] : [])]) };
  if (d.box) return { headers: [d.xLabel || "Group", "Minimum", "Lower quartile", "Median", "Upper quartile", "Maximum", "Rows"], rows: d.categories.map((c, i) => [c, ...d.box!.stats[i]!, d.box!.counts[i]!]) };
  if (d.matrix) {
    const { xs, ys, cells } = d.matrix;
    return { headers: [d.xLabel, d.yLabel, "Value"], rows: cells.map(([x, y, v]) => [xs[x]!, ys[y]!, v]) };
  }
  return { headers: [d.xLabel, ...d.series.map((s) => s.name)], rows: d.categories.map((c, i) => [c, ...d.series.map((s) => s.values[i] ?? null)]) };
}
