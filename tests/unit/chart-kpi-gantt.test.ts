/* eslint-disable @typescript-eslint/no-explicit-any -- ECharts options are untyped records; the tests probe their shape */
import { describe, expect, it } from "vitest";
import { buildEChartsOption, formatFigure } from "@/features/charts/echarts-option";
import { renderChartSvg } from "@/features/charts/svg";
import { FALLBACK_CHART_THEME } from "@/features/charts/theme";
import { chartConfigSchema, chartTable, kpiConfigFor, recommend, runChartQuery, switchKind, type ChartConfig } from "@/lib/charts";
import { buildDataset, readText } from "@/lib/data";

const ds = (csv: string) => buildDataset(readText(csv), {}, () => "d").dataset;
const cfg = (c: Partial<ChartConfig>) => chartConfigSchema.parse(c);
const run = (d: ReturnType<typeof ds>, c: Partial<ChartConfig>) => {
  const r = runChartQuery(d, cfg(c));
  if (!r.ok) throw new Error(r.error);
  return r.data;
};
const option = (d: ReturnType<typeof ds>, c: Partial<ChartConfig>, size?: { width: number; height: number }) => buildEChartsOption(run(d, c), cfg(c), FALLBACK_CHART_THEME, { size }) as Record<string, any>;
const texts = (o: Record<string, any>) => o.graphic.elements.map((e: any) => e.style.text as string);

describe("number tile", () => {
  const D = ds("when,region,sales\n2026-01-05,N,40\n2026-01-20,S,60\n2026-02-03,N,70\n2026-02-18,S,50");
  it("shows the overall figure when no date is chosen", () => {
    const d = run(D, { kind: "kpi", y: ["sales"] });
    expect(d.kpi).toMatchObject({ value: 220, label: "Sum of sales" });
    expect(d.kpi!.period).toBeUndefined();
  });
  it("honours the aggregation", () => {
    expect(run(D, { kind: "kpi", y: ["sales"], aggregation: "avg" }).kpi!.value).toBe(55);
    expect(run(D, { kind: "kpi", aggregation: "count" }).kpi).toMatchObject({ value: 4, label: "Count" });
    expect(run(D, { kind: "kpi", y: ["sales"], aggregation: "max" }).kpi!.value).toBe(70);
  });
  it("with a date, shows the latest month and its change from the month before", () => {
    const d = run(D, { kind: "kpi", y: ["sales"], x: "when" });
    expect(d.kpi).toMatchObject({ value: 120, previous: 100, period: "2026-02", previousPeriod: "2026-01" });
    expect(d.kpi!.change).toBeCloseTo(0.2, 10);
    expect(d.notes.join(" ")).toMatch(/Latest month is 2026-02, compared with 2026-01/);
  });
  it("can compare by year", () => {
    const Y = ds("when,v\n2025-06-01,10\n2026-06-01,5");
    const d = run(Y, { kind: "kpi", y: ["v"], x: "when", timeBucket: "year" });
    expect(d.kpi!.change).toBeCloseTo(-0.5, 10);
  });
  it("one period only: no comparison, and it says so; a zero baseline gives no percentage", () => {
    const one = run(ds("when,v\n2026-01-01,5\n2026-01-09,5"), { kind: "kpi", y: ["v"], x: "when" });
    expect(one.kpi!.change).toBeUndefined();
    expect(one.notes.join(" ")).toMatch(/nothing to compare/);
    const zero = run(ds("when,v\n2026-01-01,0\n2026-02-01,5"), { kind: "kpi", y: ["v"], x: "when" });
    expect(zero.kpi!.change).toBeUndefined();
  });
  it("explains what it needs", () => {
    expect(() => run(D, { kind: "kpi" })).toThrow(/needs a numeric column/);
    expect(() => run(D, { kind: "kpi", y: ["sales"], x: "region" })).toThrow(/needs a date column/);
  });
  it("draws the label, the figure and a coloured change, with a prefix and suffix", () => {
    const o = option(D, { kind: "kpi", y: ["sales"], x: "when", prefix: "$", suffix: "k", title: "Revenue" });
    expect(texts(o)).toEqual(["Revenue", "$120k", "▲ 20% vs 2026-01"]);
    expect(o.graphic.elements[2].style.fill).toBe(FALLBACK_CHART_THEME.positive);
    const down = option(ds("when,v\n2026-01-01,10\n2026-02-01,5"), { kind: "kpi", y: ["v"], x: "when" });
    expect(texts(down)[2]).toBe("▼ 50% vs 2026-01");
    expect(down.graphic.elements[2].style.fill).toBe(FALLBACK_CHART_THEME.negative);
  });
  it("scales the figure to the box and never overflows its width", () => {
    const big = option(D, { kind: "kpi", y: ["sales"] }, { width: 600, height: 400 }).graphic.elements[1].style.font as string;
    const tiny = option(D, { kind: "kpi", y: ["sales"] }, { width: 120, height: 70 }).graphic.elements[1].style.font as string;
    const px = (f: string) => Number(/(\d+)px/.exec(f)![1]);
    expect(px(big)).toBeGreaterThan(px(tiny));
    expect(px(tiny)).toBeGreaterThanOrEqual(24);
  });
  it("formats figures compactly and honestly", () => {
    expect(formatFigure(1234)).toBe("1,234");
    expect(formatFigure(0.256)).toBe("0.26");
    expect(formatFigure(15300)).toBe("15.3K");
    expect(formatFigure(3_400_000, "$")).toBe("$3.4M");
    expect(formatFigure(-2500, "", "%")).toBe("-2,500%");
    expect(formatFigure(null)).toBe("–");
  });
  it("exports as well-formed SVG (no unescaped quotes in the font)", () => {
    const { svg } = renderChartSvg(D, cfg({ kind: "kpi", y: ["sales"], x: "when" }), { width: 320, height: 180 });
    expect(new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("parsererror")).toBeNull();
    expect(svg).toContain("120");
  });
  it("its table states the figure and the comparison", () => {
    const t = chartTable(run(D, { kind: "kpi", y: ["sales"], x: "when" }));
    expect(t.headers).toEqual(["Measure", "Value", "Period", "Previous value", "Change (%)"]);
    expect(t.rows[0]).toEqual(["Sum of sales", 120, "2026-02", 100, 20]);
  });
  it("a dashboard tile is a sensible default for a dataset", () => {
    const c = kpiConfigFor(D);
    expect(c).toMatchObject({ kind: "kpi", y: ["sales"], x: "when", timeBucket: "month", aggregation: "sum" });
    expect(kpiConfigFor(ds("name\na\nb"))).toMatchObject({ kind: "kpi", y: [], aggregation: "count" });
  });
});

describe("Gantt", () => {
  const D = ds("Task,Start,End,Team\nDesign,2026-01-05,2026-01-20,Product\nBuild,2026-01-15,2026-03-01,Eng\nLaunch,2026-03-02,2026-03-05,Eng\nBroken,2026-02-10,2026-02-01,Eng\nNo end,2026-02-01,,Product");
  const base = { kind: "gantt" as const, x: "Task", y: ["Start", "End"] };
  it("lists the valid tasks by start date and reports the ones it left out", () => {
    const d = run(D, base);
    expect(d.categories).toEqual(["Design", "Build", "Launch"]);
    expect(d.gantt!.tasks[1]).toMatchObject({ start: Date.parse("2026-01-15"), end: Date.parse("2026-03-01") });
    expect(d.gantt!.min).toBe(Date.parse("2026-01-05"));
    expect(d.gantt!.max).toBe(Date.parse("2026-03-05"));
    expect(d.notes.join(" ")).toMatch(/1 row ends before it starts/);
    expect(d.notes.join(" ")).toMatch(/1 row is missing a start or end date/);
  });
  it("colours by group, one series per group, so the legend names them", () => {
    const o = option(D, { ...base, series: "Team" });
    expect(o.series.map((s: any) => s.name)).toEqual(["Product", "Eng"]);
    expect(o.series[1].data).toHaveLength(2);
    expect([o.legend].flat()[0].show).toBe(true);
    expect(o.series.every((s: any) => s.type === "custom")).toBe(true);
  });
  it("without a group it is one series and no legend", () => {
    const o = option(D, base);
    expect(o.series).toHaveLength(1);
    expect([o.legend].flat()[0].show).toBe(false);
  });
  it("draws a bar from the start to the end of the last day, clipped to the plot", () => {
    const o = option(D, base);
    const coordSys = { x: 100, y: 10, width: 500, height: 300 };
    const api = {
      value: (n: number) => o.series[0].data[0].value[n] as number,
      coord: ([t, row]: number[]) => [100 + ((t! - o.xAxis.min) / (o.xAxis.max - o.xAxis.min)) * 500, 10 + (row! + 0.5) * 100],
      size: () => [0, 100],
      style: () => ({}),
    };
    const item = o.series[0].renderItem({ coordSys }, api);
    expect(item.type).toBe("rect");
    expect(item.shape.x).toBeGreaterThanOrEqual(100);
    expect(item.shape.x + item.shape.width).toBeLessThanOrEqual(600);
    expect(item.shape.height).toBeCloseTo(60, 5);
    // A task wholly outside the visible window draws nothing instead of a stray sliver.
    const off = o.series[0].renderItem({ coordSys: { ...coordSys, x: 5000 } }, { ...api, coord: () => [0, 0] });
    expect(off).toBeUndefined();
  });
  it("tooltip gives the dates and the length in days", () => {
    const o = option(D, base);
    const text = o.tooltip.formatter({ data: o.series[0].data[0] });
    expect(text).toContain("Design");
    expect(text).toContain("2026-01-05 to 2026-01-20");
    expect(text).toContain("16 days");
  });
  it("needs a name and two date columns, and says which is missing", () => {
    expect(() => run(D, { kind: "gantt", y: ["Start", "End"] })).toThrow(/names each task/);
    expect(() => run(D, { kind: "gantt", x: "Task", y: ["Start"] })).toThrow(/start date column and an end date column/);
    expect(() => run(D, { kind: "gantt", x: "Task", y: ["Start", "Team"] })).toThrow(/start date column and an end date column/);
  });
  it("keeps the first tasks by start date when there are too many, and says so", () => {
    const rows = Array.from({ length: 80 }, (_, i) => `T${i},2026-01-${String((i % 28) + 1).padStart(2, "0")},2026-02-15`);
    const d = run(ds(["Task,Start,End", ...rows].join("\n")), { kind: "gantt", x: "Task", y: ["Start", "End"] });
    expect(d.categories).toHaveLength(60);
    expect(d.notes.join(" ")).toMatch(/first 60 of 80 tasks/);
  });
  it("exports as well-formed SVG with every task name", () => {
    const { svg } = renderChartSvg(D, cfg({ ...base, series: "Team", title: "Plan" }));
    expect(new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("parsererror")).toBeNull();
    for (const t of ["Design", "Build", "Launch", "Plan"]) expect(svg).toContain(t);
  });
  it("its table lists each task with its length", () => {
    const t = chartTable(run(D, { ...base, series: "Team" }));
    expect(t.headers).toEqual(["Task", "Start", "End", "Days", "Group"]);
    expect(t.rows[0]).toEqual(["Design", "2026-01-05", "2026-01-20", 15, "Product"]);
  });
  it("is the recommendation when the data is a schedule", () => {
    const rec = recommend(D);
    expect(rec.kind).toBe("gantt");
    expect(rec.config).toMatchObject({ x: "Task", y: ["Start", "End"], series: "Team" });
    expect(rec.reason).toMatch(/Gantt chart shows the schedule/);
  });
  it("switching to a Gantt clears measures so the date columns are chosen deliberately", () => {
    expect(switchKind(cfg({ x: "a", y: ["m"], series: "s" }), "gantt")).toMatchObject({ y: [], series: undefined });
    expect(switchKind(cfg({ x: "when", y: ["m"] }), "kpi").x).toBeUndefined();
  });
});

describe("recommendations offer number tiles", () => {
  it("for a measure over time and for a category with a measure", () => {
    const time = recommend(ds("when,v\n2026-01-01,1\n2026-02-01,2\n2026-03-01,3")).alternatives.map((a) => a.kind);
    expect(time).toContain("kpi");
    const rows = Array.from({ length: 12 }, (_, i) => `${["A", "B", "C"][i % 3]},${(i + 1) * 7}`); // not a 1..n counter, which would count as a row number
    expect(recommend(ds(["g,v", ...rows].join("\n"))).alternatives.map((a) => a.kind)).toContain("kpi");
  });
});
