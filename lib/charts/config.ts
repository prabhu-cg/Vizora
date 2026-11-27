import { z } from "zod";

export const CHART_KINDS = [
  "bar", "hbar", "line", "area", "pie", "donut", "scatter",
  "stacked-bar", "grouped-bar", "multi-line", "heatmap", "histogram", "treemap",
  "stacked-100", "combo", "boxplot", "funnel", "kpi", "gantt",
] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

export interface KindMeta {
  label: string;
  group: "basic" | "advanced";
  /** One line telling people what the chart is for and what it needs. */
  hint: string;
}

export const KIND_META: Record<ChartKind, KindMeta> = {
  bar: { label: "Bar", group: "basic", hint: "Compare values across categories." },
  hbar: { label: "Horizontal bar", group: "basic", hint: "Compare categories with long names, or many of them." },
  line: { label: "Line", group: "basic", hint: "Show change over time or along an ordered axis." },
  area: { label: "Area", group: "basic", hint: "Like a line, emphasising volume." },
  pie: { label: "Pie", group: "basic", hint: "Parts of a whole, for a few categories." },
  donut: { label: "Donut", group: "basic", hint: "Parts of a whole, with room for a total." },
  scatter: { label: "Scatter", group: "basic", hint: "Relationship between two numeric columns." },
  "stacked-bar": { label: "Stacked bar", group: "advanced", hint: "Totals split into parts, per category." },
  "grouped-bar": { label: "Grouped bar", group: "advanced", hint: "Several measures side by side, per category." },
  "multi-line": { label: "Multi-series line", group: "advanced", hint: "Several lines to compare trends." },
  heatmap: { label: "Heatmap", group: "advanced", hint: "A measure across two categorical columns." },
  histogram: { label: "Histogram", group: "advanced", hint: "How the values of one numeric column are distributed." },
  treemap: { label: "Treemap", group: "advanced", hint: "Hierarchical proportions as nested rectangles." },
  "stacked-100": { label: "100% stacked bar", group: "advanced", hint: "Each category's mix as a share of 100%, to compare composition." },
  combo: { label: "Bar and line", group: "advanced", hint: "Bars for one measure and a line for another, optionally on a second axis." },
  boxplot: { label: "Box plot", group: "advanced", hint: "The spread of one numeric column: median, quartiles and outliers, per group." },
  funnel: { label: "Funnel", group: "advanced", hint: "Stages that shrink, such as sign-up to purchase." },
  kpi: { label: "Number tile", group: "basic", hint: "One headline figure, optionally compared with the previous period." },
  gantt: { label: "Gantt (schedule)", group: "advanced", hint: "Tasks as bars from a start date to an end date." },
};

export const AGGREGATIONS = ["sum", "avg", "count", "min", "max"] as const;
export type Aggregation = (typeof AGGREGATIONS)[number];
export const AGG_LABEL: Record<Aggregation, string> = { sum: "Sum", avg: "Average", count: "Count", min: "Minimum", max: "Maximum" };

export const FILTER_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in", "empty", "notEmpty"] as const;
export type FilterOp = (typeof FILTER_OPS)[number];
export const FILTER_OP_LABEL: Record<FilterOp, string> = {
  eq: "is", neq: "is not", gt: "is greater than", gte: "is at least", lt: "is less than", lte: "is at most",
  contains: "contains", in: "is one of", empty: "is empty", notEmpty: "is not empty",
};

export const TIME_BUCKETS = ["none", "day", "month", "year"] as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const chartConfigSchema = z.object({
  kind: z.enum(CHART_KINDS).default("bar"),
  datasetId: z.string().max(128).optional(),
  /** X axis / categories. A dimension, or a numeric column for scatter and histogram. */
  x: z.string().max(200).optional(),
  /** Measures (numeric columns). */
  y: z.array(z.string().max(200)).max(12).default([]),
  /** A dimension that splits the data into series (or the second axis of a heatmap). */
  series: z.string().max(200).optional(),
  aggregation: z.enum(AGGREGATIONS).default("sum"),
  timeBucket: z.enum(TIME_BUCKETS).default("none"),
  title: z.string().max(200).default(""),
  subtitle: z.string().max(300).default(""),
  xLabel: z.string().max(100).optional(),
  yLabel: z.string().max(100).optional(),
  legend: z.object({ show: z.boolean().default(true), position: z.enum(["top", "bottom", "left", "right"]).default("bottom") }).default({ show: true, position: "bottom" }),
  dataLabels: z.boolean().default(false),
  tooltips: z.boolean().default(true),
  sort: z.object({ by: z.enum(["none", "value", "label"]).default("none"), dir: z.enum(["asc", "desc"]).default("desc") }).default({ by: "none", dir: "desc" }),
  limit: z.number().int().min(1).max(500).optional(),
  groupOthers: z.boolean().default(false),
  filters: z
    .array(z.object({ column: z.string().max(200), op: z.enum(FILTER_OPS), value: z.string().max(500).default("") }))
    .max(20)
    .default([]),
  palette: z.string().max(40).default("theme"),
  colors: z.record(z.string(), hex).default({}),
  smooth: z.boolean().default(false),
  /** Number tile: text shown before and after the figure, such as "$" or "%". */
  prefix: z.string().max(10).default(""),
  suffix: z.string().max(10).default(""),
  /** Bar and line: which measures (column keys) are drawn as lines. Empty means the last measure. */
  lines: z.array(z.string().max(200)).max(12).default([]),
  /** Bar and line: draw the line measures against a second axis on the right. */
  secondaryAxis: z.boolean().default(true),
  bins: z.number().int().min(2).max(60).optional(),
});

export type ChartConfig = z.infer<typeof chartConfigSchema>;
export type ChartFilter = ChartConfig["filters"][number];

export function defaultConfig(kind: ChartKind = "bar"): ChartConfig {
  return chartConfigSchema.parse({ kind });
}

/** Read a chart config from document options, tolerating missing or damaged values. */
export function readChartConfig(options: Record<string, unknown> | undefined): ChartConfig | undefined {
  const raw = options?.chart;
  if (raw === undefined) return undefined;
  const r = chartConfigSchema.safeParse(raw);
  return r.success ? r.data : undefined;
}

export const PALETTES: Record<string, { label: string; colors: string[] | null; note: string }> = {
  theme: { label: "Vizora", colors: null, note: "Follows light and dark themes." },
  "colour-blind": { label: "Colour-blind safe", colors: ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#56b4e9", "#d55e00", "#f0e442", "#000000"], note: "Okabe–Ito palette, distinguishable with common colour-vision differences." },
  cool: { label: "Cool", colors: ["#1f5f9e", "#2a9d8f", "#5aa9e6", "#264653", "#7ec8a5", "#3d5a80"], note: "Blues and greens." },
  warm: { label: "Warm", colors: ["#e8b923", "#d4572a", "#b3261e", "#f4a261", "#8a5a00", "#e76f51"], note: "Ambers and reds." },
  mono: { label: "Greyscale", colors: ["#353335", "#6b6b6b", "#8a7f6e", "#b9b3a6", "#4d4a4d", "#d4cfc2"], note: "Prints well in black and white." },
};

export const isChartKind = (v: string): v is ChartKind => (CHART_KINDS as readonly string[]).includes(v);

/** Which kinds put categories on the X axis and aggregate a measure per category. */
export const CATEGORY_KINDS: readonly ChartKind[] = ["bar", "hbar", "line", "area", "pie", "donut", "stacked-bar", "grouped-bar", "multi-line", "treemap", "stacked-100", "combo", "funnel"];  // kpi and gantt have their own branches in the query
