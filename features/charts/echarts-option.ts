import type { ChartConfig } from "@/lib/charts";
import type { ChartData } from "@/lib/charts/query";
import { FALLBACK_CHART_THEME, colourFor, readableOn, type ChartTheme } from "./theme";

export type EChartsOption = Record<string, unknown>;

export interface OptionFlags {
  /** Accessibility hatch patterns on screen; off in exported images. */
  decal?: boolean;
  animate?: boolean;
}

const CARTESIAN = new Set(["bar", "hbar", "line", "area", "stacked-bar", "grouped-bar", "multi-line", "histogram"]);

/**
 * ChartData + configuration → an Apache ECharts option. Pure: nothing here
 * reads the DOM or the data again, so what the tests assert is what is drawn.
 */
export function buildEChartsOption(data: ChartData, config: ChartConfig, theme: ChartTheme = FALLBACK_CHART_THEME, flags: OptionFlags = {}): EChartsOption {
  const { kind } = config;
  const xName = config.xLabel ?? data.xLabel;
  const yName = config.yLabel ?? data.yLabel;
  const textStyle = { fontFamily: "inherit", color: theme.text };
  const common: EChartsOption = {
    textStyle,
    animation: flags.animate ?? true,
    aria: { enabled: true, decal: { show: flags.decal ?? false } },
    title: config.title || config.subtitle ? { text: config.title, subtext: config.subtitle, left: 0, top: 0, textStyle: { color: theme.text, fontSize: 16, fontWeight: 600, fontFamily: "inherit" }, subtextStyle: { color: theme.muted, fontFamily: "inherit" } } : undefined,
    tooltip: { show: config.tooltips, trigger: CARTESIAN.has(kind) ? "axis" : "item", confine: true },
  };
  // A few entries sit in a plain row at the bottom, all visible. Many entries would crush the
  // chart, so they move to a vertical list on the right that scrolls instead.
  const legendNames: string[] = kind === "pie" || kind === "donut" ? data.categories : data.series.map((x) => x.name);
  const MANY = 8;
  const many = legendNames.length > MANY;
  const legendPos: ChartConfig["legend"]["position"] = many && config.legend.show ? "right" : config.legend.position;
  const sideLegend = legendPos === "left" || legendPos === "right";
  const legendRows = (names: string[]) => (sideLegend ? 1 : Math.max(1, Math.ceil(names.reduce((n, x) => n + Math.min(x.length, 24) * 7 + 44, 0) / 620)));
  const legendBase = (names: string[]) => ({
    show: config.legend.show && names.length > 0,
    data: names,
    type: many ? "scroll" : "plain",
    itemGap: many ? 8 : 14,
    formatter: (n: string) => { const max = sideLegend ? (many ? 18 : 11) : 28; return n.length > max ? `${n.slice(0, max - 1)}…` : n; },
    tooltip: { show: true },
    textStyle: { color: theme.text },
    pageIconColor: theme.text,
    pageTextStyle: { color: theme.muted },
    ...(legendPos === "top" ? { top: config.title || config.subtitle ? 36 : 0, left: "center" } : legendPos === "bottom" ? { bottom: 0, left: "center" } : legendPos === "left" ? { left: 0, top: 8, bottom: 8, width: legendWidth, orient: "vertical" } : { right: 0, top: 8, bottom: 8, width: legendWidth, orient: "vertical" }),
  });
  const rows = config.legend.show ? legendRows(legendNames) : 0;
  const legendWidth = many ? 150 : 96;
  const sideWidth = legendWidth + 28; // legend plus a gutter, so it never touches the plot
  const headroom = (config.title || config.subtitle ? 44 : 8) + (config.legend.show && legendPos === "top" ? 8 + rows * 24 : 0);
  const grid = {
    left: legendPos === "left" && config.legend.show ? sideWidth : 12,
    right: legendPos === "right" && config.legend.show ? sideWidth : 24,
    top: headroom + 8,
    bottom: (legendPos === "bottom" && config.legend.show ? 14 + rows * 24 : 8) + (xName || kind === "hbar" ? 22 : 0),
    containLabel: true,
  };
  const axisLine = { lineStyle: { color: theme.grid } };
  const split = { lineStyle: { color: theme.grid } };
  const label = (extra: EChartsOption = {}) => ({ show: config.dataLabels, color: theme.text, ...extra });

  // ── Scatter ───────────────────────────────────────────────────────────────
  if (kind === "scatter" && data.points) {
    const groups = [...new Set(data.points.map((p) => p.series ?? ""))];
    const names = groups.map((g) => g || data.yLabel);
    const colours = colourFor(names, config, theme);
    return {
      ...common,
      color: colours,
      legend: legendBase(groups.length > 1 || groups[0] ? names : []),
      grid,
      xAxis: { type: "value", name: xName, nameLocation: "middle", nameGap: 28, scale: true, axisLine, splitLine: split },
      yAxis: { type: "value", name: yName, nameLocation: "end", scale: true, axisLine, splitLine: split },
      series: groups.map((g, i) => ({ name: names[i], type: "scatter", symbolSize: 9, itemStyle: { opacity: 0.8 }, label: label({ position: "top", formatter: (p: { value: number[] }) => String(p.value[1]) }), data: data.points!.filter((p) => (p.series ?? "") === g).map((p) => [p.x, p.y]) })),
    };
  }

  // ── Heatmap ───────────────────────────────────────────────────────────────
  if (kind === "heatmap" && data.matrix) {
    const m = data.matrix;
    const [accent] = colourFor(["x"], config, theme);
    return {
      ...common,
      grid: { ...grid, bottom: grid.bottom + 56 },
      xAxis: { type: "category", data: m.xs, name: xName, nameLocation: "middle", nameGap: 26, splitArea: { show: true }, axisLabel: { hideOverlap: true }, axisLine },
      yAxis: { type: "category", data: m.ys, name: yName, axisLine, splitArea: { show: true } },
      visualMap: { min: m.min, max: m.max, calculable: true, orient: "horizontal", left: "center", bottom: 4, itemWidth: 14, itemHeight: 140, textStyle: { color: theme.text }, inRange: { color: [theme.heatLow, accent!] } },
      series: [{ name: data.series[0]?.name ?? yName, type: "heatmap", data: m.cells, label: label({ position: "inside" }), emphasis: { itemStyle: { shadowBlur: 6 } } }],
    };
  }

  // ── Treemap ───────────────────────────────────────────────────────────────
  if (kind === "treemap" && data.tree) {
    const colours = colourFor(data.tree.map((n) => n.name), config, theme);
    return {
      ...common,
      color: colours,
      series: [{ type: "treemap", top: headroom, left: 8, right: 8, bottom: 8, roam: false, nodeClick: false, breadcrumb: { show: false }, label: { show: true, overflow: "truncate", formatter: "{b}" }, upperLabel: { show: false }, itemStyle: { borderColor: theme.surface, borderWidth: 2, gapWidth: 2 }, data: data.tree.map((n, i) => ({ name: n.name, value: n.value, itemStyle: { color: colours[i] }, label: { color: readableOn(colours[i]!, theme) }, children: n.children?.map((c) => ({ name: c.name, value: c.value, label: { color: readableOn(colours[i]!, theme) } })) })) }],
    };
  }

  // ── Pie / donut ───────────────────────────────────────────────────────────
  if (kind === "pie" || kind === "donut") {
    const s = data.series[0];
    const items = data.categories.map((name, i) => ({ name, value: s?.values[i] ?? 0 })).filter((d) => d.value > 0);
    const colours = colourFor(items.map((d) => d.name), config, theme);
    return {
      ...common,
      color: colours,
      legend: legendBase(items.map((d) => d.name)),
      series: [{ name: s?.name ?? "", type: "pie", radius: kind === "donut" ? ["46%", `${70 - (rows - 1) * 3}%`] : `${68 - (rows - 1) * 3}%`, center: [config.legend.show && legendPos === "right" ? "40%" : config.legend.show && legendPos === "left" ? "60%" : "50%", config.legend.show && legendPos === "bottom" ? `${50 - rows * 3.5}%` : legendPos === "top" && config.legend.show ? `${52 + rows * 3.5}%` : "52%"], avoidLabelOverlap: true, itemStyle: { borderColor: theme.surface, borderWidth: 2 }, label: { show: config.dataLabels, color: theme.text, formatter: "{b}: {d}%" }, labelLine: { show: config.dataLabels }, data: items }],
    };
  }

  // ── Cartesian: bar family, line family, histogram ─────────────────────────
  const names = data.series.map((s) => s.name);
  const colours = colourFor(names, config, theme);
  const horizontal = kind === "hbar";
  const stacked = kind === "stacked-bar";
  const isLine = kind === "line" || kind === "area" || kind === "multi-line";
  const counts = kind === "histogram" || config.aggregation === "count";
  const category = { type: "category", data: data.categories, name: xName, nameLocation: horizontal ? "end" : "middle", nameGap: 28, axisLine, axisLabel: { hideOverlap: true, color: theme.text }, ...(horizontal ? { inverse: true } : {}), ...(kind === "histogram" ? { axisTick: { alignWithLabel: true } } : {}) };
  const value = { type: "value", name: yName, nameLocation: horizontal ? "middle" : "end", nameGap: 30, axisLine, splitLine: split, axisLabel: { color: theme.text }, ...(counts ? { minInterval: 1 } : {}) };
  const series = data.series.map((s, i) => ({
    name: s.name,
    type: isLine ? "line" : "bar",
    data: s.values,
    ...(stacked ? { stack: "total" } : {}),
    ...(kind === "area" ? { areaStyle: { opacity: 0.25 } } : {}),
    ...(isLine ? { smooth: config.smooth, symbolSize: 6, connectNulls: false } : { itemStyle: { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] }, ...(kind === "histogram" ? { barCategoryGap: "4%" } : {}) }),
    label: label({ position: stacked ? "inside" : isLine ? "top" : horizontal ? "right" : "top" }),
    color: colours[i],
  }));
  return {
    ...common,
    color: colours,
    legend: legendBase(data.series.length > 1 ? names : []),
    grid,
    xAxis: horizontal ? value : category,
    yAxis: horizontal ? category : value,
    series,
  };
}
