import { profileDataset } from "@/lib/data/profile";
import type { ColumnProfile } from "@/lib/data/types";
import type { Dataset } from "@/types/visualisation";
import { chartConfigSchema, defaultConfig, type Aggregation, type ChartConfig, type ChartKind, KIND_META } from "./config";

export interface Suggestion {
  kind: ChartKind;
  config: ChartConfig;
  /** Plain-language reason, naming the columns involved. */
  reason: string;
}

export interface Recommendation extends Suggestion {
  alternatives: Suggestion[];
}

export interface Selection {
  x?: string;
  y?: string[];
  series?: string;
}

const ID_NAME = /^(id|index|idx|uuid|guid|row|rownum|no|#)$|(^|[ _-])id$/i;
/** Numbers that are really labels or buckets (zip codes, bins), so they are not worth summing or plotting. */
const LABEL_NUMBER = /(zip|postal|post ?code|\(bin\)|[ _-]bin$|^bin$)/i;
const SHARE_NAME = /(share|percent|pct|proportion|mix|split|breakdown|composition|portion|%)/i;
const q = (c: { label: string }) => `“${c.label}”`;
const list = (cs: { label: string }[]) => (cs.length <= 2 ? cs.map(q).join(" and ") : `${cs.slice(0, 2).map(q).join(", ")} and ${cs.length - 2} more`);

function isIdLike(c: ColumnProfile, rows: number): boolean {
  if (ID_NAME.test(c.label.trim()) || ID_NAME.test(c.key)) return true;
  // An unnamed 1..n (or 0..n-1) counter is a row number, not a measure. Other runs of integers are real data.
  return c.type === "number" && rows > 5 && c.distinct === rows && (c.min === 0 || c.min === 1) && typeof c.max === "number" && c.max - (c.min as number) === rows - 1;
}

/** True when each child value belongs to exactly one parent value (a hierarchy such as city → country). */
function nestsInside(dataset: Dataset, child: string, parent: string): boolean {
  const owner = new Map<string, string>();
  let clash = 0;
  for (const r of dataset.rows) {
    const c = r[child], p = r[parent];
    if (c === null || p === null || c === undefined || p === undefined) continue;
    const prev = owner.get(String(c));
    if (prev === undefined) owner.set(String(c), String(p));
    else if (prev !== String(p)) clash++;
  }
  return owner.size > 1 && clash / Math.max(1, dataset.rows.length) < 0.03;
}

const withKind = (c: ChartConfig, kind: ChartKind, extra: Partial<ChartConfig> = {}): ChartConfig => chartConfigSchema.parse({ ...c, kind, ...extra });

/**
 * Deterministic chart recommendation from the shape of the data (and, when the
 * user has already chosen columns, from those). The same dataset always gives
 * the same answer, and every answer says why.
 */
export function recommend(dataset: Dataset, selection: Selection = {}): Recommendation {
  const profile = profileDataset(dataset);
  const rows = dataset.rows.length;
  const cols = profile.columns;
  const byKey = new Map(cols.map((c) => [c.key, c]));
  const measures = cols.filter((c) => c.type === "number" && !isIdLike(c, rows) && !LABEL_NUMBER.test(c.label) && c.count > 0);
  const dates = cols.filter((c) => c.type === "date" && c.count > 0);
  const cats = cols.filter((c) => (c.type === "string" || c.type === "boolean") && c.distinct >= 2 && c.distinct <= 50 && !isIdLike(c, rows));
  const base = chartConfigSchema.parse({ datasetId: dataset.id });
  const unit = (c: ColumnProfile) => (c.min !== undefined && typeof c.min === "number" && c.min >= 0 ? "" : " (it has negative values)");
  const nonNegative = (c?: ColumnProfile) => !!c && typeof c.min === "number" && c.min >= 0;

  const alternatives: Suggestion[] = [];
  const add = (kind: ChartKind, config: ChartConfig, reason: string) => {
    if (!alternatives.some((a) => a.kind === kind)) alternatives.push({ kind, config, reason });
  };
  // The attached config must always draw the chart the recommendation names.
  const result = (primary: Suggestion): Recommendation => ({ ...primary, config: withKind(primary.config, primary.kind), alternatives: alternatives.filter((a) => a.kind !== primary.kind).slice(0, 5) });

  // ── The user has already chosen columns: respect them. ────────────────────
  const sx = selection.x ? byKey.get(selection.x) : undefined;
  const sy = (selection.y ?? []).map((k) => byKey.get(k)).filter((c): c is ColumnProfile => !!c);
  const ss = selection.series ? byKey.get(selection.series) : undefined;
  if (sx || sy.length) {
    const cfg = chartConfigSchema.parse({ ...base, x: sx?.key, y: sy.map((c) => c.key), series: ss?.key });
    if (sx?.type === "number" && sy[0]?.type === "number") {
      return result({ kind: "scatter", config: withKind(cfg, "scatter"), reason: `You chose two numeric columns, ${q(sx)} and ${q(sy[0])}. A scatter plot shows whether they move together.` });
    }
    if (sx?.type === "date") {
      const kind: ChartKind = sy.length > 1 || ss ? "multi-line" : "line";
      add("area", withKind(cfg, "area"), "An area chart emphasises volume over time.");
      add("bar", withKind(cfg, "bar"), "Bars make individual periods easy to compare.");
      return result({ kind, config: withKind(cfg, kind), reason: `${q(sx)} is a date, so a line chart shows how ${sy.length ? list(sy) : "the values"} change over time.` });
    }
    if (sx && !sy.length) {
      return result({ kind: "bar", config: withKind(cfg, "bar", { aggregation: "count" }), reason: `You chose only ${q(sx)}, so the chart counts how many rows fall in each value.` });
    }
    if (!sx && sy.length === 1 && sy[0]!.type === "number") {
      return result({ kind: "histogram", config: withKind({ ...cfg, x: sy[0]!.key, y: [] }, "histogram"), reason: `One numeric column, ${q(sy[0]!)}: a histogram shows how its values are distributed.` });
    }
    const kind: ChartKind = ss ? "stacked-bar" : sy.length > 1 ? "grouped-bar" : "bar";
    add("hbar", withKind(cfg, "hbar"), "Horizontal bars suit long category names.");
    if (!ss && sy.length === 1 && sx && sx.distinct <= 8 && nonNegative(sy[0])) add("donut", withKind(cfg, "donut"), "With few categories you can show parts of a whole.");
    return result({ kind, config: withKind(cfg, kind), reason: `${q(sx ?? sy[0]!)} against ${sy.length ? list(sy) : "a count"}: ${kind === "bar" ? "a bar chart compares categories" : kind === "stacked-bar" ? "stacked bars split each total by the series" : "grouped bars compare the measures side by side"}.` });
  }

  // ── Automatic ─────────────────────────────────────────────────────────────
  if (cols.length === 0 || rows === 0) {
    return { kind: "bar", config: withKind(base, "bar"), reason: "There is no data yet. Add some to get a recommendation.", alternatives: [] };
  }

  // 1. Time series
  if (dates.length && measures.length) {
    const time = dates[0]!;
    const ys = measures.slice(0, 3);
    // Hundreds of distinct dates make an unreadable line: group them by month, or by year over a long span.
    const first = Date.parse(String(time.min)), last = Date.parse(String(time.max));
    const months = Number.isFinite(first) && Number.isFinite(last) ? (last - first) / 2.63e9 : 0;
    const timeBucket = time.distinct > 120 ? (months > 120 ? "year" : "month") : "none";
    const cfg = chartConfigSchema.parse({ ...base, x: time.key, y: ys.map((m) => m.key), timeBucket });
    const kind: ChartKind = ys.length > 1 ? "multi-line" : "line";
    add("area", withKind(cfg, "area"), `An area chart emphasises how much ${q(ys[0]!)} there is over time.`);
    add("bar", withKind(cfg, "bar"), "Bars make individual periods easy to compare.");
    if (cats[0]) add("stacked-bar", withKind(cfg, "stacked-bar", { y: [ys[0]!.key], series: cats[0].key }), `Stacked bars split ${q(ys[0]!)} by ${q(cats[0])} in each period.`);
    if (ys.length === 1 && cats[0]) add("multi-line", withKind(cfg, "multi-line", { series: cats[0].key }), `One line per ${q(cats[0])} compares their trends.`);
    return result({
      kind,
      config: cfg,
      reason: `${q(time)} is a date and ${list(ys)} ${ys.length > 1 ? "are numbers" : "is a number"}: a ${ys.length > 1 ? "multi-series " : ""}line chart shows how ${ys.length > 1 ? "they" : "it"} change${ys.length > 1 ? "" : "s"} over time${timeBucket === "none" ? "" : `, grouped by ${timeBucket} because there are ${time.distinct.toLocaleString()} different dates`}.`,
    });
  }

  // 2. Categories with measures
  if (cats.length && measures.length) {
    const x = cats.slice().sort((a, b) => a.distinct - b.distinct).find((c) => c.distinct >= 2) ?? cats[0]!;
    const second = cats.find((c) => c.key !== x.key);
    const m = measures[0]!;

    // Hierarchy: child nests inside parent → treemap
    for (const parent of cats) for (const child of cats) {
      if (parent.key !== child.key && parent.distinct < child.distinct && nestsInside(dataset, child.key, parent.key) && nonNegative(m)) {
        const cfg = chartConfigSchema.parse({ ...base, x: parent.key, series: child.key, y: [m.key] });
        const flat = chartConfigSchema.parse({ ...base, x: parent.key, y: [m.key] });
        add("bar", withKind(flat, "bar"), `Bars compare ${q(parent)} totals directly.`);
        add("stacked-bar", withKind(cfg, "stacked-bar"), `Stacked bars show each ${q(child)} within its ${q(parent)}.`);
        return result({ kind: "treemap", config: withKind(cfg, "treemap"), reason: `${q(child)} values each belong to one ${q(parent)}, so the data is hierarchical. A treemap shows how ${q(m)} divides across both levels.` });
      }
    }

    const cfg = chartConfigSchema.parse({ ...base, x: x.key, y: measures.slice(0, 1).map((c) => c.key) });
    const wholeLike = x.distinct <= 6 && nonNegative(m) && (SHARE_NAME.test(m.label) || SHARE_NAME.test(dataset.name) || SHARE_NAME.test(x.label));
    if (x.distinct <= 6 && nonNegative(m)) {
      add(wholeLike ? "bar" : "donut", withKind(cfg, wholeLike ? "bar" : "donut"), wholeLike ? `Bars compare the ${x.distinct} categories exactly.` : `With only ${x.distinct} categories, a donut shows each one's share of the total.`);
      add("pie", withKind(cfg, "pie"), `A pie shows each of the ${x.distinct} categories as a share of the whole.`);
    }
    add("hbar", withKind(cfg, "hbar"), x.distinct > 8 ? `Horizontal bars read better with ${x.distinct} categories.` : "Horizontal bars suit long category names.");
    if (measures.length > 1) {
      const multi = withKind({ ...cfg, y: measures.slice(0, 3).map((c) => c.key) }, "grouped-bar");
      add("grouped-bar", multi, `Compare ${list(measures.slice(0, 3))} side by side for each ${q(x)}.`);
      add("stacked-bar", withKind(multi, "stacked-bar"), "Stacked bars show how the measures add up.");
    }
    if (second) {
      add("stacked-bar", withKind({ ...cfg, series: second.key }, "stacked-bar"), `Stacked bars split ${q(m)} by ${q(second)} within each ${q(x)}.`);
      if (x.distinct <= 30 && second.distinct <= 30) add("heatmap", withKind({ ...cfg, series: second.key }, "heatmap"), `A heatmap shows ${q(m)} for every ${q(x)} and ${q(second)} combination.`);
    }
    if (measures.length >= 2) add("scatter", withKind({ ...cfg, x: measures[0]!.key, y: [measures[1]!.key] }, "scatter"), `${q(measures[0]!)} against ${q(measures[1]!)} shows whether they move together.`);

    if (wholeLike) {
      return result({ kind: "donut", config: withKind(cfg, "donut"), reason: `${q(x)} has only ${x.distinct} values and ${q(m)} looks like shares of a whole${unit(m)}. A donut shows each part's proportion.` });
    }
    if (measures.length > 1) {
      return result({ kind: "grouped-bar", config: withKind({ ...cfg, y: measures.slice(0, 3).map((c) => c.key) }, "grouped-bar"), reason: `You have a category, ${q(x)}, and several measures (${list(measures.slice(0, 3))}). Grouped bars compare them for each ${q(x)}.` });
    }
    return result({ kind: "bar", config: withKind(cfg, "bar"), reason: `${q(x)} is a category and ${q(m)} is a number: a bar chart compares ${q(m)} across ${x.distinct} categories.` });
  }

  // 3. Only numbers
  if (measures.length >= 2) {
    const cfg = chartConfigSchema.parse({ ...base, x: measures[0]!.key, y: [measures[1]!.key] });
    add("histogram", withKind({ ...cfg, y: [] }, "histogram"), `A histogram shows how ${q(measures[0]!)} alone is distributed.`);
    return result({ kind: "scatter", config: withKind(cfg, "scatter"), reason: `Two numeric columns, ${q(measures[0]!)} and ${q(measures[1]!)}: a scatter plot shows whether they move together.` });
  }
  if (measures.length === 1) {
    const cfg = chartConfigSchema.parse({ ...base, x: measures[0]!.key, y: [] });
    return result({ kind: "histogram", config: withKind(cfg, "histogram"), reason: `Only one numeric column, ${q(measures[0]!)}: a histogram shows how its values are distributed.` });
  }

  // 4. Only categories: count rows
  const any = cats[0] ?? cols.find((c) => c.type !== "number") ?? cols[0]!;
  const agg: Aggregation = "count";
  const cfg = chartConfigSchema.parse({ ...base, x: any.key, y: [], aggregation: agg });
  add("hbar", withKind(cfg, "hbar"), "Horizontal bars read well for counts of named things.");
  if (any.distinct <= 8) add("donut", withKind(cfg, "donut"), "With few values you can show each one's share of the rows.");
  return result({ kind: "bar", config: withKind(cfg, "bar"), reason: `There are no numeric columns, so the chart counts how many rows have each ${q(any)}.` });
}

/** A starting configuration for a dataset (the recommendation's config). */
export function autoConfig(dataset: Dataset): ChartConfig {
  return recommend(dataset).config;
}

/** Re-target an existing configuration at a new kind, adjusting fields the new kind cannot use. */
export function switchKind(config: ChartConfig, kind: ChartKind): ChartConfig {
  const next = { ...config, kind };
  if (kind === "pie" || kind === "donut") return chartConfigSchema.parse({ ...next, y: config.y.slice(0, 1), series: undefined });
  if (kind === "histogram") return chartConfigSchema.parse({ ...next, x: config.x, y: [], series: undefined });
  return chartConfigSchema.parse(next);
}

export const kindLabel = (k: ChartKind) => KIND_META[k].label;
void defaultConfig;
