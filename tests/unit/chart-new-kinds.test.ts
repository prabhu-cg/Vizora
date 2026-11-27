/* eslint-disable @typescript-eslint/no-explicit-any -- ECharts options are untyped records; the tests probe their shape */
import { describe, expect, it } from "vitest";
import { buildEChartsOption } from "@/features/charts/echarts-option";
import { FALLBACK_CHART_THEME } from "@/features/charts/theme";
import { chartConfigSchema, chartTable, recommend, runChartQuery, switchKind, type ChartConfig } from "@/lib/charts";
import { buildDataset, readText } from "@/lib/data";

const ds = (csv: string) => buildDataset(readText(csv), {}, () => "d").dataset;
const cfg = (c: Partial<ChartConfig>) => chartConfigSchema.parse(c);
const run = (d: ReturnType<typeof ds>, c: Partial<ChartConfig>) => {
  const r = runChartQuery(d, cfg(c));
  if (!r.ok) throw new Error(r.error);
  return r.data;
};
const option = (d: ReturnType<typeof ds>, c: Partial<ChartConfig>) => buildEChartsOption(run(d, c), cfg(c), FALLBACK_CHART_THEME) as Record<string, any>;

describe("funnel", () => {
  const D = ds("stage,people\nVisit,1000\nSign up,400\nTrial,150\nPaid,60\nAbandoned,0");
  it("orders stages from largest to smallest whatever the data order", () => {
    const shuffled = ds("stage,people\nPaid,60\nVisit,1000\nTrial,150\nSign up,400");
    expect(run(shuffled, { kind: "funnel", x: "stage", y: ["people"] }).categories).toEqual(["Visit", "Sign up", "Trial", "Paid"]);
  });
  it("draws a funnel series, leaving out stages with nothing in them", () => {
    const o = option(D, { kind: "funnel", x: "stage", y: ["people"] });
    expect(o.series[0].type).toBe("funnel");
    expect(o.series[0].data.map((d: { name: string }) => d.name)).toEqual(["Visit", "Sign up", "Trial", "Paid"]);
  });
  it("uses one measure, and says so", () => {
    const two = ds("stage,a,b\nx,1,2\ny,3,4");
    expect(run(two, { kind: "funnel", x: "stage", y: ["a", "b"] }).notes.join(" ")).toMatch(/funnel shows one measure/);
  });
});

describe("100% stacked bar", () => {
  const D = ds("region,channel,units\nNorth,web,30\nNorth,shop,10\nSouth,web,10\nSouth,shop,10");
  it("shows each category as shares of 100, and keeps the real values in the tooltip", () => {
    const o = option(D, { kind: "stacked-100", x: "region", y: ["units"], series: "channel" });
    const byName = Object.fromEntries(o.series.map((s: any) => [s.name, s.data]));
    expect(byName.web).toEqual([75, 50]);
    expect(byName.shop).toEqual([25, 50]);
    expect(o.series.every((s: any) => s.stack === "total")).toBe(true);
    expect(o.yAxis.max).toBe(100);
    const text = o.tooltip.formatter([{ dataIndex: 0, seriesName: "web", marker: "", value: 75 }]);
    expect(text).toMatch(/web: 75%/);
    expect(text).toMatch(/\(30\)/);
  });
  it("leaves a category with no total empty instead of dividing by zero", () => {
    const Z = ds("g,s,v\nA,x,0\nA,y,0\nB,x,5\nB,y,5");
    const o = option(Z, { kind: "stacked-100", x: "g", y: ["v"], series: "s" });
    expect(o.series[0].data[0]).toBeNull();
    expect(o.series[0].data[1]).toBe(50);
  });
});

describe("bar and line", () => {
  const D = ds("month,revenue,margin\nJan,100,0.10\nFeb,120,0.15\nMar,90,0.05");
  it("by default the last measure is a line on a second axis", () => {
    const o = option(D, { kind: "combo", x: "month", y: ["revenue", "margin"] });
    expect(o.series.map((s: any) => s.type)).toEqual(["bar", "line"]);
    expect(o.series[1].yAxisIndex).toBe(1);
    expect(Array.isArray(o.yAxis) && o.yAxis).toHaveLength(2);
    expect(o.yAxis[1].position).toBe("right");
  });
  it("you choose which measures are lines, and can keep one axis", () => {
    const o = option(D, { kind: "combo", x: "month", y: ["revenue", "margin"], lines: ["revenue"], secondaryAxis: false });
    expect(o.series.map((s: any) => s.type)).toEqual(["line", "bar"]);
    expect(Array.isArray(o.yAxis)).toBe(false);
    expect(o.series.some((s: any) => s.yAxisIndex !== undefined)).toBe(false);
  });
  it("makes room for the second axis", () => {
    const one = option(D, { kind: "combo", x: "month", y: ["revenue", "margin"], secondaryAxis: false });
    const two = option(D, { kind: "combo", x: "month", y: ["revenue", "margin"] });
    expect(two.grid.right).toBeGreaterThan(one.grid.right);
  });
  it("with a single measure it is just a bar chart", () => {
    const o = option(D, { kind: "combo", x: "month", y: ["revenue"] });
    expect(o.series.map((s: any) => s.type)).toEqual(["bar"]);
  });
});

describe("box plot", () => {
  // Group A: 1..9 and an outlier 100. Group B: 10, 20, 30.
  const D = ds(["g,v", ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 100].map((v) => `A,${v}`), ...[10, 20, 30].map((v) => `B,${v}`)].join("\n"));
  it("computes the five-number summary by hand-checked quartiles and finds the outlier", () => {
    const d = run(D, { kind: "boxplot", x: "g", y: ["v"] });
    expect(d.categories).toEqual(["A", "B"]);
    // A sorted: 1..9,100 (n=10). q1 = 3.25, median = 5.5, q3 = 7.75; fence = 1.5*4.5 = 6.75, so 100 is an outlier and the top whisker is 9.
    expect(d.box!.stats[0]).toEqual([1, 3.25, 5.5, 7.75, 9]);
    expect(d.box!.stats[1]).toEqual([10, 15, 20, 25, 30]);
    expect(d.box!.counts).toEqual([10, 3]);
    expect(d.box!.outliers).toEqual([[0, 100]]);
  });
  it("without a grouping column it summarises the whole column", () => {
    const d = run(D, { kind: "boxplot", y: ["v"] });
    expect(d.categories).toEqual(["v"]);
    expect(d.box!.counts).toEqual([13]);
  });
  it("draws a boxplot series plus the outliers", () => {
    const o = option(D, { kind: "boxplot", x: "g", y: ["v"] });
    expect(o.series.map((s: any) => s.type)).toEqual(["boxplot", "scatter"]);
    expect(o.series[1].data).toEqual([[0, 100]]);
    expect(o.legend.show).toBe(false);
  });
  it("needs a numeric column and says so; ignores empty cells and reports them", () => {
    expect(() => run(D, { kind: "boxplot", x: "g" })).toThrow(/needs a numeric column/);
    const gaps = ds("g,v\nA,1\nA,\nA,3");
    const d = run(gaps, { kind: "boxplot", x: "g", y: ["v"] });
    expect(d.box!.counts).toEqual([2]);
    expect(d.notes.join(" ")).toMatch(/1 row has no value/);
  });
  it("keeps the groups with the most rows when there are too many, and says so", () => {
    const rows = Array.from({ length: 60 }, (_, i) => `g${i},${i}`).concat(Array.from({ length: 5 }, () => "busy,1"));
    const d = run(ds(["g,v", ...rows].join("\n")), { kind: "boxplot", x: "g", y: ["v"] });
    expect(d.categories).toHaveLength(30);
    expect(d.categories).toContain("busy");
    expect(d.notes.join(" ")).toMatch(/30 groups with the most rows of 61/);
  });
  it("its table lists the summary for each group", () => {
    const t = chartTable(run(D, { kind: "boxplot", x: "g", y: ["v"] }));
    expect(t.headers).toEqual(["g", "Minimum", "Lower quartile", "Median", "Upper quartile", "Maximum", "Rows"]);
    expect(t.rows[1]).toEqual(["B", 10, 15, 20, 25, 30, 3]);
  });
});

describe("switching to the new kinds keeps the configuration valid", () => {
  const base = cfg({ x: "g", y: ["a", "b"], series: "s", lines: ["a"] });
  it("funnel and box plot keep one measure and drop the series", () => {
    for (const k of ["funnel", "boxplot"] as const) {
      const c = switchKind(base, k);
      expect(c.y).toEqual(["a"]);
      expect(c.series).toBeUndefined();
    }
  });
  it("combo and 100% stacked keep everything", () => {
    expect(switchKind(base, "combo").y).toEqual(["a", "b"]);
    expect(switchKind(base, "stacked-100").series).toBe("s");
  });
});

describe("recommendations offer the new charts where they fit", () => {
  it("offers a box plot when each category has many rows, and a funnel for a few stages", () => {
    const rows = Array.from({ length: 40 }, (_, i) => `${["A", "B", "C", "D"][i % 4]},${i * 3 + 10}`);
    const kinds = recommend(ds(["team,score", ...rows].join("\n"))).alternatives.map((a) => a.kind);
    expect(kinds).toContain("boxplot");
    expect(kinds).toContain("funnel");
  });
  it("offers bar and line for several measures, and 100% stacked for two categories", () => {
    const rows = Array.from({ length: 24 }, (_, i) => `${["N", "S", "E", "W"][i % 4]},${["web", "shop", "app"][i % 3]},${i + 5},${i * 2}`);
    const kinds = recommend(ds(["region,channel,units,price", ...rows].join("\n"))).alternatives.map((a) => a.kind);
    expect(kinds).toContain("stacked-100");
    expect(kinds).toContain("combo");
  });
});
