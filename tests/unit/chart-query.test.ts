import { describe, expect, it } from "vitest";
import { buildDataset, readText } from "@/lib/data";
import { chartConfigSchema, chartTable, readChartConfig, runChartQuery, type ChartConfig } from "@/lib/charts";
import type { ChartData } from "@/lib/charts/query";
import type { Dataset } from "@/types/visualisation";

const ds = (csv: string): Dataset => buildDataset(readText(csv), {}, () => "d").dataset;
const cfg = (c: Partial<ChartConfig>): ChartConfig => chartConfigSchema.parse(c);
const ok = (d: Dataset, c: Partial<ChartConfig>): ChartData => {
  const r = runChartQuery(d, cfg(c));
  if (!r.ok) throw new Error(r.error);
  return r.data;
};
const err = (d: Dataset, c: Partial<ChartConfig>): string => {
  const r = runChartQuery(d, cfg(c));
  if (r.ok) throw new Error("expected an error");
  return r.error;
};

// Hand-calculated fixture.
//   North: 10, 20, 30 (sum 60, avg 20, min 10, max 30, n=3)
//   South: 5, (missing)  (sum 5, avg 5, n=1, rows=2)
//   East : 7             (sum 7)
const SALES = ds("region,channel,units,price\nNorth,web,10,2\nNorth,shop,20,4\nSouth,web,5,6\nNorth,web,30,8\nSouth,shop,,10\nEast,web,7,12");

describe("aggregation", () => {
  it.each([
    ["sum", { North: 60, South: 5, East: 7 }],
    ["avg", { North: 20, South: 5, East: 7 }],
    ["min", { North: 10, South: 5, East: 7 }],
    ["max", { North: 30, South: 5, East: 7 }],
    ["count", { North: 3, South: 2, East: 1 }], // counts rows, including the one with a missing measure
  ] as const)("%s per category", (aggregation, expected) => {
    const d = ok(SALES, { kind: "bar", x: "region", y: ["units"], aggregation });
    expect(Object.fromEntries(d.categories.map((c, i) => [c, d.series[0]!.values[i]]))).toEqual(expected);
  });
  it("keeps first-appearance order, ignores empty values and says so", () => {
    const d = ok(SALES, { kind: "bar", x: "region", y: ["units"] });
    expect(d.categories).toEqual(["North", "South", "East"]);
    expect(d.notes.join(" ")).toMatch(/1 empty value was ignored/);
    expect(d.rowsUsed).toBe(6);
  });
  it("a category whose measure is entirely missing is null, not zero", () => {
    const d = ok(ds("k,v\nA,1\nB,\nB,NA"), { kind: "bar", x: "k", y: ["v"] });
    expect(d.series[0]!.values).toEqual([1, null]);
  });
  it("labels the axes from the data and the aggregation", () => {
    const d = ok(SALES, { kind: "bar", x: "region", y: ["units"], aggregation: "avg" });
    expect([d.xLabel, d.yLabel, d.series[0]!.name]).toEqual(["region", "Average of units", "Average of units"]);
    expect(ok(SALES, { kind: "bar", x: "region", aggregation: "count" }).yLabel).toBe("Count");
  });
});

describe("series", () => {
  it("several measures become several series", () => {
    const d = ok(SALES, { kind: "grouped-bar", x: "region", y: ["units", "price"] });
    expect(d.series.map((s) => [s.name, s.values])).toEqual([["Sum of units", [60, 5, 7]], ["Sum of price", [14, 16, 12]]]);
  });
  it("a Series column pivots one measure", () => {
    const d = ok(SALES, { kind: "stacked-bar", x: "region", y: ["units"], series: "channel" });
    expect(d.series.map((s) => [s.name, s.values])).toEqual([["web", [40, 5, 7]], ["shop", [20, null, null]]]);
  });
  it("tells you when only one measure can be shown", () => {
    expect(ok(SALES, { kind: "bar", x: "region", y: ["units", "price"], series: "channel" }).notes.join(" ")).toMatch(/one measure/);
  });
});

describe("dates and ordering", () => {
  const T = ds("day,amount\n2026-03-15,3\n2026-01-02,1\n2026-01-20,2\n2026-02-10,5\n2026-03-01,4");
  it("sorts a date axis chronologically", () => {
    expect(ok(T, { kind: "line", x: "day", y: ["amount"] }).categories).toEqual(["2026-01-02", "2026-01-20", "2026-02-10", "2026-03-01", "2026-03-15"]);
  });
  it.each([
    ["month", ["2026-01", "2026-02", "2026-03"], [3, 5, 7]],
    ["year", ["2026"], [15]],
  ] as const)("buckets by %s", (timeBucket, cats, vals) => {
    const d = ok(T, { kind: "line", x: "day", y: ["amount"], timeBucket });
    expect(d.categories).toEqual(cats);
    expect(d.series[0]!.values).toEqual(vals);
  });
  it("sorts numeric categories numerically", () => {
    expect(ok(ds("n,v\n10,1\n2,1\n1,1"), { kind: "bar", x: "n", y: ["v"] }).categories).toEqual(["1", "2", "10"]);
  });
});

describe("sorting, top N and Other", () => {
  const D = ds("k,v\nA,1\nB,50\nC,20\nD,5\nE,2");
  it("sorts by value or label, ascending or descending", () => {
    expect(ok(D, { kind: "bar", x: "k", y: ["v"], sort: { by: "value", dir: "desc" } }).categories).toEqual(["B", "C", "D", "E", "A"]);
    expect(ok(D, { kind: "bar", x: "k", y: ["v"], sort: { by: "value", dir: "asc" } }).categories).toEqual(["A", "E", "D", "C", "B"]);
    expect(ok(D, { kind: "bar", x: "k", y: ["v"], sort: { by: "label", dir: "desc" } }).categories).toEqual(["E", "D", "C", "B", "A"]);
  });
  it("limits to the top N by value and reports the rest", () => {
    const d = ok(D, { kind: "bar", x: "k", y: ["v"], limit: 2 });
    expect(d.categories).toEqual(["B", "C"]);
    expect(d.notes.join(" ")).toMatch(/top 2 of 5/);
  });
  it("can group the remainder as Other (sums and counts only)", () => {
    const d = ok(D, { kind: "pie", x: "k", y: ["v"], limit: 2, groupOthers: true });
    expect(d.categories).toEqual(["B", "C", "Other"]);
    expect(d.series[0]!.values).toEqual([50, 20, 8]);
    const avg = ok(D, { kind: "bar", x: "k", y: ["v"], aggregation: "avg", limit: 2, groupOthers: true });
    expect(avg.categories).toEqual(["B", "C"]); // an average of averages would be wrong, so it truncates instead
  });
});

describe("filters", () => {
  const f = (column: string, op: ChartConfig["filters"][number]["op"], value = "") => ({ column, op, value });
  const total = (filters: ChartConfig["filters"]) => ok(SALES, { kind: "bar", x: "region", y: ["units"], filters }).series[0]!.values.reduce<number>((a, v) => a + (v ?? 0), 0);
  it("applies typed comparisons", () => {
    expect(total([f("units", "gt", "10")])).toBe(50);
    expect(total([f("units", "gte", "10")])).toBe(60);
    expect(total([f("units", "lt", "10")])).toBe(12);
    expect(total([f("units", "lte", "10")])).toBe(22);
    expect(total([f("units", "eq", "20")])).toBe(20);
    expect(total([f("region", "eq", "north")])).toBe(60);
    expect(total([f("region", "neq", "North")])).toBe(12);
    expect(total([f("region", "contains", "ou")])).toBe(5);
    expect(total([f("region", "in", "south, east")])).toBe(12);
    expect(total([f("units", "empty")])).toBe(0);
    expect(total([f("units", "notEmpty")])).toBe(72);
  });
  it("combines filters with AND, reports hidden rows, and ignores unfinished numeric filters", () => {
    const d = ok(SALES, { kind: "bar", x: "region", y: ["units"], filters: [f("channel", "eq", "web"), f("units", "gt", "5")] });
    expect(d.rowsUsed).toBe(3);
    expect(d.notes.join(" ")).toMatch(/3 rows are hidden/);
    expect(total([f("units", "gt", "")])).toBe(72);
  });
  it("explains when nothing matches", () => {
    expect(err(SALES, { kind: "bar", x: "region", y: ["units"], filters: [f("region", "eq", "Mars")] })).toMatch(/No rows match/);
  });
  it("compares dates chronologically", () => {
    const T = ds("d,v\n2026-01-01,1\n2026-02-01,2\n2026-03-01,4");
    expect(ok(T, { kind: "bar", x: "d", y: ["v"], filters: [{ column: "d", op: "gte", value: "2026-02-01" }] }).categories).toEqual(["2026-02-01", "2026-03-01"]);
  });
});

describe("chart kinds", () => {
  it("scatter: pairs, series, and missing values reported", () => {
    const d = ok(SALES, { kind: "scatter", x: "units", y: ["price"], series: "channel" });
    expect(d.points).toEqual([
      { x: 10, y: 2, series: "web" }, { x: 20, y: 4, series: "shop" }, { x: 5, y: 6, series: "web" }, { x: 30, y: 8, series: "web" }, { x: 7, y: 12, series: "web" },
    ]);
    expect(d.notes.join(" ")).toMatch(/1 row has a missing X or Y/);
  });
  it("scatter caps very large datasets and says it sampled", () => {
    const big = ds("a,b\n" + Array.from({ length: 12000 }, (_, i) => `${i},${i * 2}`).join("\n"));
    const d = ok(big, { kind: "scatter", x: "a", y: ["b"] });
    expect(d.points!.length).toBeLessThanOrEqual(5000);
    expect(d.notes.join(" ")).toMatch(/every 3rd of 12,000/);
  });
  it("histogram: bin counts add up to the number of values", () => {
    const d = ok(ds("v\n1\n2\n2\n3\n3\n3\n4\n4\n4\n4\n10"), { kind: "histogram", x: "v", bins: 3 });
    expect(d.categories).toEqual(["1–4", "4–7", "7–10"]);
    expect(d.series[0]!.values).toEqual([6, 4, 1]);
    expect(d.series[0]!.values!.reduce<number>((a, v) => a + (v ?? 0), 0)).toBe(11);
  });
  it("histogram of identical values is a single bar", () => {
    expect(ok(ds("v\n5\n5\n5"), { kind: "histogram", x: "v" }).series[0]!.values).toEqual([3]);
  });
  it("heatmap: aggregates the measure for each pair of categories", () => {
    const d = ok(SALES, { kind: "heatmap", x: "region", series: "channel", y: ["units"] });
    const m = d.matrix!;
    const cell = (x: string, y: string) => m.cells.find(([xi, yi]) => m.xs[xi] === x && m.ys[yi] === y)?.[2];
    expect([cell("North", "web"), cell("North", "shop"), cell("South", "web"), cell("East", "web")]).toEqual([40, 20, 5, 7]);
    expect([m.min, m.max]).toEqual([5, 40]);
  });
  it("treemap: parents are the sum of their children", () => {
    const d = ok(SALES, { kind: "treemap", x: "region", series: "channel", y: ["units"] });
    expect(d.tree!.find((n) => n.name === "North")).toEqual({ name: "North", value: 60, children: [{ name: "web", value: 40 }, { name: "shop", value: 20 }] });
  });
  it("pie keeps negatives out and says so; treemap rejects all-negative data", () => {
    const neg = ds("k,v\nA,5\nB,-2");
    expect(ok(neg, { kind: "pie", x: "k", y: ["v"] }).notes.join(" ")).toMatch(/Negative values/);
    expect(err(ds("k,v\nA,-5\nB,-2"), { kind: "treemap", x: "k", y: ["v"] })).toMatch(/positive values/);
  });
  it("area, hbar, donut and line produce the same numbers as bar", () => {
    const bar = ok(SALES, { kind: "bar", x: "region", y: ["units"] }).series;
    for (const kind of ["hbar", "area", "line", "donut", "pie"] as const) expect(ok(SALES, { kind, x: "region", y: ["units"] }).series).toEqual(bar);
  });
});

describe("guidance when the setup is incomplete", () => {
  it.each([
    [{ kind: "bar", y: ["units"] }, /Choose a column for the X axis/],
    [{ kind: "bar", x: "region" }, /numeric column to measure/],
    [{ kind: "bar", x: "region", y: ["channel"] }, /not numeric/],
    [{ kind: "scatter", x: "region", y: ["units"] }, /numeric column for X/],
    [{ kind: "scatter", x: "units" }, /numeric column for Y/],
    [{ kind: "histogram", x: "region" }, /numeric column/],
    [{ kind: "heatmap", x: "region", y: ["units"] }, /second categorical column/],
    [{ kind: "bar", x: "gone", y: ["units"] }, /no longer in this dataset/],
  ] as const)("%j", (config, message) => {
    expect(err(SALES, config as Partial<ChartConfig>)).toMatch(message);
  });
  it("an empty dataset says so", () => {
    expect(err({ columns: [{ key: "a", label: "a", type: "string" }], rows: [] } as unknown as Dataset, { kind: "bar", x: "a", aggregation: "count" })).toMatch(/no rows/);
  });
});

describe("the table behind a chart", () => {
  it("is what the chart shows, ready for display or CSV", () => {
    const t = chartTable(ok(SALES, { kind: "grouped-bar", x: "region", y: ["units", "price"] }));
    expect(t.headers).toEqual(["region", "Sum of units", "Sum of price"]);
    expect(t.rows).toEqual([["North", 60, 14], ["South", 5, 16], ["East", 7, 12]]);
  });
});

describe("configuration", () => {
  it("fills defaults and validates", () => {
    const c = chartConfigSchema.parse({});
    expect(c).toMatchObject({ kind: "bar", aggregation: "sum", legend: { show: true, position: "top" }, tooltips: true, dataLabels: false, filters: [], colors: {} });
    expect(chartConfigSchema.safeParse({ colors: { A: "red" } }).success).toBe(false);
    expect(chartConfigSchema.safeParse({ colors: { A: "#aabbcc" } }).success).toBe(true);
    expect(chartConfigSchema.safeParse({ kind: "radar" }).success).toBe(false);
  });
  it("is read tolerantly from document options", () => {
    expect(readChartConfig(undefined)).toBeUndefined();
    expect(readChartConfig({ chart: { kind: "nonsense" } })).toBeUndefined();
    expect(readChartConfig({ chart: { kind: "line", x: "d" } })).toMatchObject({ kind: "line", x: "d" });
  });
});
