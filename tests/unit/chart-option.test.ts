/* eslint-disable @typescript-eslint/no-explicit-any -- ECharts options are untyped records; the tests probe their shape */
import { describe, expect, it } from "vitest";
import { buildEChartsOption } from "@/features/charts/echarts-option";
import { renderChartSvg } from "@/features/charts/svg";
import { FALLBACK_CHART_THEME, colourFor, readableOn } from "@/features/charts/theme";
import { CHART_KINDS, chartConfigSchema, runChartQuery, type ChartConfig } from "@/lib/charts";
import { buildDataset, readText } from "@/lib/data";
import type { Dataset } from "@/types/visualisation";

const D: Dataset = buildDataset(readText("region,channel,units,price,when\nNorth,web,10,2,2026-01-01\nNorth,shop,20,4,2026-02-01\nSouth,web,5,6,2026-03-01\nEast,shop,7,12,2026-04-01"), {}, () => "d").dataset;
const cfg = (c: Partial<ChartConfig>) => chartConfigSchema.parse(c);
const opt = (c: Partial<ChartConfig>) => {
  const config = cfg(c);
  const r = runChartQuery(D, config);
  if (!r.ok) throw new Error(r.error);
  return buildEChartsOption(r.data, config) as Record<string, any>;
};

const BASE = { x: "region", y: ["units"] };
const FIXTURES: Record<string, Partial<ChartConfig>> = {
  bar: { kind: "bar", ...BASE }, hbar: { kind: "hbar", ...BASE }, line: { kind: "line", x: "when", y: ["units"] }, area: { kind: "area", x: "when", y: ["units"] },
  pie: { kind: "pie", ...BASE }, donut: { kind: "donut", ...BASE }, scatter: { kind: "scatter", x: "units", y: ["price"] },
  "stacked-bar": { kind: "stacked-bar", ...BASE, series: "channel" }, "grouped-bar": { kind: "grouped-bar", x: "region", y: ["units", "price"] },
  "multi-line": { kind: "multi-line", x: "when", y: ["units", "price"] }, heatmap: { kind: "heatmap", x: "region", series: "channel", y: ["units"] },
  histogram: { kind: "histogram", x: "units" }, treemap: { kind: "treemap", ...BASE, series: "channel" },
};

describe("chart option builder", () => {
  it("bar: categories on X, values in the series", () => {
    const o = opt(FIXTURES.bar!);
    expect(o.xAxis).toMatchObject({ type: "category", data: ["North", "South", "East"] });
    expect(o.yAxis.type).toBe("value");
    expect(o.series[0]).toMatchObject({ type: "bar", data: [30, 5, 7], name: "Sum of units" });
  });
  it("horizontal bar swaps the axes and keeps the first category on top", () => {
    const o = opt(FIXTURES.hbar!);
    expect(o.yAxis).toMatchObject({ type: "category", inverse: true, name: "region" });
    expect(o.xAxis).toMatchObject({ type: "value", name: "Sum of units", nameLocation: "middle" }); // titled, not clipped at the edge
  });
  it("stacked bar stacks; grouped bar does not", () => {
    expect(opt(FIXTURES["stacked-bar"]!).series.every((s: any) => s.stack === "total")).toBe(true);
    const g = opt(FIXTURES["grouped-bar"]!);
    expect(g.series).toHaveLength(2);
    expect(g.series.some((s: any) => s.stack)).toBe(false);
  });
  it("line, area and multi-line", () => {
    expect(opt(FIXTURES.line!).series[0]).toMatchObject({ type: "line", smooth: false });
    expect(opt(FIXTURES.area!).series[0].areaStyle).toBeTruthy();
    expect(opt(FIXTURES["multi-line"]!).series).toHaveLength(2);
    expect(opt({ ...FIXTURES.line!, smooth: true }).series[0].smooth).toBe(true);
  });
  it("pie and donut differ only by the hole", () => {
    expect(opt(FIXTURES.pie!).series[0].radius).toBe("68%");
    expect(opt(FIXTURES.donut!).series[0].radius).toEqual(["46%", "70%"]);
    expect(opt(FIXTURES.pie!).series[0].data).toEqual([{ name: "North", value: 30 }, { name: "South", value: 5 }, { name: "East", value: 7 }]);
  });
  it("scatter plots the numeric pairs", () => {
    expect(opt(FIXTURES.scatter!).series[0]).toMatchObject({ type: "scatter", data: [[10, 2], [20, 4], [5, 6], [7, 12]] });
  });
  it("heatmap carries a colour scale spanning the data", () => {
    const o = opt(FIXTURES.heatmap!);
    expect(o.visualMap).toMatchObject({ min: 5, max: 20 });
    expect(o.series[0].type).toBe("heatmap");
    expect(o.series[0].data).toHaveLength(4);
  });
  it("count axes never show fractional ticks", () => {
    expect(opt(FIXTURES.histogram!).yAxis.minInterval).toBe(1);
    expect(opt({ kind: "bar", x: "region", aggregation: "count" }).yAxis.minInterval).toBe(1);
    expect(opt(FIXTURES.bar!).yAxis.minInterval).toBeUndefined();
  });
  it("histogram and treemap", () => {
    expect(opt(FIXTURES.histogram!).series[0].type).toBe("bar");
    const t = opt(FIXTURES.treemap!);
    expect(t.series[0].type).toBe("treemap");
    expect(t.series[0].data.find((n: any) => n.name === "North")).toMatchObject({ value: 30, children: [{ name: "web", value: 10 }, { name: "shop", value: 20 }] });
  });
  it("treemap labels stay readable: dark text on light tiles, white on dark ones", () => {
    expect(readableOn("#e8b923", FALLBACK_CHART_THEME)).toBe(FALLBACK_CHART_THEME.labelOnLight); // amber
    expect(readableOn("#146c43", FALLBACK_CHART_THEME)).toBe(FALLBACK_CHART_THEME.labelOnDark); // green
    expect(readableOn("#353335", FALLBACK_CHART_THEME)).toBe(FALLBACK_CHART_THEME.labelOnDark);
    const tiles = opt(FIXTURES.treemap!).series[0].data;
    expect(tiles.every((n: any) => typeof n.label.color === "string")).toBe(true);
  });
  it.each(CHART_KINDS)("%s has an accessible description enabled and no stray undefined keys", (kind) => {
    const o = opt(FIXTURES[kind]!);
    expect(o.aria.enabled).toBe(true);
    expect(JSON.stringify(o)).toBeTruthy();
  });
});

describe("chart editing options reach the chart", () => {
  it("title, subtitle, axis labels", () => {
    const o = opt({ ...FIXTURES.bar!, title: "Sales", subtitle: "By region", xLabel: "Area", yLabel: "Units sold" });
    expect(o.title).toMatchObject({ text: "Sales", subtext: "By region" });
    expect(o.xAxis.name).toBe("Area");
    expect(o.yAxis.name).toBe("Units sold");
    expect(opt(FIXTURES.bar!).xAxis.name).toBe("region"); // from the data when not set
  });
  it("legend: shown only with several series, hideable, positionable", () => {
    expect(opt(FIXTURES.bar!).legend.show).toBe(false);
    expect(opt(FIXTURES["grouped-bar"]!).legend.show).toBe(true);
    expect(opt({ ...FIXTURES["grouped-bar"]!, legend: { show: false, position: "top" } }).legend.show).toBe(false);
    expect(opt({ ...FIXTURES["grouped-bar"]!, legend: { show: true, position: "bottom" } }).legend).toMatchObject({ bottom: 0 });
    expect(opt({ ...FIXTURES["grouped-bar"]!, legend: { show: true, position: "right" } }).legend).toMatchObject({ right: 0, orient: "vertical" });
  });
  it("data labels and tooltips toggle", () => {
    expect(opt(FIXTURES.bar!).series[0].label.show).toBe(false);
    expect(opt({ ...FIXTURES.bar!, dataLabels: true }).series[0].label.show).toBe(true);
    expect(opt(FIXTURES.bar!).tooltip.show).toBe(true);
    expect(opt({ ...FIXTURES.bar!, tooltips: false }).tooltip.show).toBe(false);
    expect(opt({ ...FIXTURES.pie!, dataLabels: true }).series[0].label.show).toBe(true);
  });
  it("sorting and limits change what is plotted", () => {
    expect(opt({ ...FIXTURES.bar!, sort: { by: "value", dir: "desc" } }).xAxis.data).toEqual(["North", "East", "South"]);
    expect(opt({ ...FIXTURES.bar!, limit: 2 }).xAxis.data).toEqual(["North", "East"]);
  });
  it("colours: palette choice and per-series overrides", () => {
    expect(opt({ ...FIXTURES["grouped-bar"]!, palette: "colour-blind" }).color.slice(0, 2)).toEqual(["#0072b2", "#e69f00"]);
    const o = opt({ ...FIXTURES["grouped-bar"]!, colors: { "Sum of price": "#112233" } });
    expect(o.color).toEqual([FALLBACK_CHART_THEME.series[0], "#112233"]);
    expect(colourFor(["a", "b"], cfg({ palette: "theme" }), FALLBACK_CHART_THEME)).toEqual(FALLBACK_CHART_THEME.series.slice(0, 2));
  });
});

describe("SVG export of every chart kind", () => {
  it.each(CHART_KINDS)("%s renders to well-formed SVG carrying its data", (kind) => {
    const { svg, width, height } = renderChartSvg(D, cfg({ ...FIXTURES[kind]!, title: `T-${kind}` }));
    const xml = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(xml.querySelector("parsererror")).toBeNull();
    expect(xml.documentElement.getAttribute("viewBox")).toBe(`0 0 ${width} ${height}`);
    expect(svg).toContain(`T-${kind}`);
    expect(svg).not.toContain("pattern"); // no accessibility hatching in exported images
  });
  it("explains a configuration that cannot be drawn", () => {
    expect(() => renderChartSvg(D, cfg({ kind: "bar" }))).toThrow(/Choose a column for the X axis/);
  });
});

describe("legend", () => {
  it("shows every entry at the bottom, as a plain wrapping legend, never a scrolling carousel", () => {
    for (const key of ["pie", "donut", "stacked-bar", "scatter", "multi-line"]) {
      const o = opt(FIXTURES[key]!);
      const legend = [o.legend].flat().filter(Boolean)[0];
      if (!legend?.show) continue;
      expect(legend.type, key).toBe("plain");
      expect(legend.bottom, key).toBe(0);
    }
  });
  it("with many entries the legend becomes a vertical, scrollable list on the right and the chart keeps its room", () => {
    const rows = Array.from({ length: 40 }, (_, i) => `c${i},${i + 1}`).join("\n");
    const D2 = buildDataset(readText(`cat,n\n${rows}`), {}, () => "d2").dataset;
    const config = cfg({ kind: "donut", x: "cat", y: ["n"] });
    const r = runChartQuery(D2, config);
    if (!r.ok) throw new Error(r.error);
    const o = buildEChartsOption(r.data, config) as Record<string, any>;
    const legend = [o.legend].flat()[0];
    expect(legend).toMatchObject({ type: "scroll", orient: "vertical", right: 0 });
    expect(o.grid?.right ?? 0).toBe(0); // (pie has no grid)
    expect(legend.bottom).toBe(8); // spans the height so it scrolls rather than overflowing
    expect(parseFloat(o.series[0].center[0])).toBeLessThan(50); // chart shifts left to make room
  });
  it("a side legend never overlaps the plot: the plot keeps a gutter wider than the legend", () => {
    const names = Array.from({ length: 30 }, (_, i) => `Film number ${i}`);
    const csv = ["cat,series,n", ...names.map((n, i) => `${i % 3 === 0 ? "A" : "B"},${n},${i + 1}`)].join("\n");
    const D3 = buildDataset(readText(csv), {}, () => "d3").dataset;
    const config = cfg({ kind: "stacked-bar", x: "cat", y: ["n"], series: "series" });
    const r = runChartQuery(D3, config);
    if (!r.ok) throw new Error(r.error);
    const o = buildEChartsOption(r.data, config) as Record<string, any>;
    const legend = [o.legend].flat()[0];
    expect(legend).toMatchObject({ orient: "vertical", right: 0 });
    expect(o.grid.right).toBeGreaterThan(legend.width);
  });
  it("leaves room for the legend rows so entries never overlap the chart", () => {
    const o = opt({ kind: "bar", ...BASE });
    expect(o.grid.bottom).toBeGreaterThanOrEqual(38);
  });
});
