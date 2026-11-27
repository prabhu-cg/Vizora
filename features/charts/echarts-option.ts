import type { ChartConfig } from "@/lib/charts";
import type { ChartData } from "@/lib/charts/query";
import { FALLBACK_CHART_THEME, colourFor, readableOn, type ChartTheme } from "./theme";

export type EChartsOption = Record<string, unknown>;

export interface OptionFlags {
  /** Accessibility hatch patterns on screen; off in exported images. */
  decal?: boolean;
  animate?: boolean;
  /** Pixel size of the drawing area. Number tiles size their text from it. */
  size?: { width: number; height: number };
}

const CARTESIAN = new Set(["bar", "hbar", "line", "area", "stacked-bar", "grouped-bar", "multi-line", "histogram", "stacked-100", "combo"]);

/**
 * ChartData + configuration → an Apache ECharts option. Pure: nothing here
 * reads the DOM or the data again, so what the tests assert is what is drawn.
 */
export function buildEChartsOption(data: ChartData, config: ChartConfig, theme: ChartTheme = FALLBACK_CHART_THEME, flags: OptionFlags = {}): EChartsOption {
  const { kind } = config;
  const xName = config.xLabel ?? data.xLabel;
  const yName = config.yLabel ?? data.yLabel;
  const textStyle = { fontFamily: "inherit", color: theme.text };
  const heavy = data.categories.length * Math.max(1, data.series.length) > 400 || (data.points?.length ?? 0) > 400;
  const common: EChartsOption = {
    textStyle,
    // Patterns and animation are for readable charts; with hundreds of marks they only cost time.
    animation: (flags.animate ?? true) && !heavy,
    aria: { enabled: true, decal: { show: (flags.decal ?? false) && !heavy } },
    title: config.title || config.subtitle ? { text: config.title, subtext: config.subtitle, left: 0, top: 0, textStyle: { color: theme.text, fontSize: 16, fontWeight: 600, fontFamily: "inherit" }, subtextStyle: { color: theme.muted, fontFamily: "inherit" } } : undefined,
    tooltip: { show: config.tooltips, trigger: CARTESIAN.has(kind) ? "axis" : "item", confine: true },
  };
  // A few entries sit in a plain row at the bottom, all visible. Many entries would crush the
  // chart, so they move to a vertical list on the right that scrolls instead.
  const legendNames: string[] = kind === "pie" || kind === "donut" || kind === "funnel" ? data.categories : data.series.map((x) => x.name);
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

  // ── Number tile ───────────────────────────────────────────────────────────
  if (kind === "kpi" && data.kpi) return kpiOption(data, config, theme, flags);

  // ── Gantt ─────────────────────────────────────────────────────────────────
  if (kind === "gantt" && data.gantt) {
    const g = data.gantt;
    const groups = g.groups.length ? g.groups : [data.yLabel || "Tasks"];
    const colours = colourFor(groups, config, theme);
    const pad = Math.max(864e5, (g.max - g.min) * 0.03);
    const day = 864e5;
    const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
    const rowsOf = (group?: string) => g.tasks.map((t, i) => ({ t, i })).filter(({ t }) => !group || (t.group ?? "") === group);
    const many = groups.length > 1;
    return {
      ...common,
      color: colours,
      tooltip: { show: config.tooltips, trigger: "item", confine: true, formatter: (p: { data: { value: (string | number)[] } }) => { const [, s, e, name] = p.data.value as [number, number, number, string]; return `${name}<br/>${fmt(s)} to ${fmt(e)} (${Math.max(1, Math.round((e - s) / day) + 1)} days)`; } },
      legend: legendBase(many ? groups : []),
      grid: { ...grid, left: Math.max(grid.left, 12) + 8, bottom: grid.bottom + 8 },
      xAxis: { type: "time", min: g.min - pad, max: g.max + pad, name: "", axisLine, splitLine: split, axisLabel: { hideOverlap: true, color: theme.text } },
      yAxis: { type: "category", data: data.categories.map((n) => (n.length > 28 ? `${n.slice(0, 27)}…` : n)), inverse: true, axisLine, axisTick: { show: false }, splitLine: { show: true, lineStyle: { color: theme.grid, type: "dashed" } }, axisLabel: { color: theme.text, hideOverlap: false } },
      series: groups.map((name, gi) => ({
        name,
        type: "custom",
        itemStyle: { color: colours[gi] },
        encode: { x: [1, 2], y: 0 },
        data: rowsOf(many ? name : undefined).map(({ t, i }) => ({ value: [i, t.start, t.end, t.name] })),
        renderItem: (params: { coordSys: { x: number; y: number; width: number; height: number } }, api: { value: (n: number) => number; coord: (v: number[]) => number[]; size: (v: number[]) => number[]; style: () => Record<string, unknown> }) => {
          const row = api.value(0);
          const a = api.coord([api.value(1), row]), b = api.coord([api.value(2) + day, row]);
          const h = Math.max(6, api.size([0, 1])[1]! * 0.6);
          const cs = params.coordSys;
          const x = Math.max(cs.x, a[0]!), x2 = Math.min(cs.x + cs.width, b[0]!);
          if (x2 <= x) return undefined;
          return { type: "rect", shape: { x, y: a[1]! - h / 2, width: Math.max(3, x2 - x), height: h, r: 4 }, style: api.style() };
        },
      })),
    };
  }

  // ── Funnel ────────────────────────────────────────────────────────────────
  if (kind === "funnel") {
    const s = data.series[0];
    const items = data.categories.map((name, i) => ({ name, value: s?.values[i] ?? 0 })).filter((d) => d.value > 0);
    const colours = colourFor(items.map((d) => d.name), config, theme);
    return {
      ...common,
      color: colours,
      legend: legendBase(items.map((d) => d.name)),
      series: [{
        name: s?.name ?? "", type: "funnel", sort: "descending", gap: 3, minSize: "8%", maxSize: "100%",
        left: grid.left + 8, right: grid.right + 8, top: grid.top, bottom: grid.bottom,
        itemStyle: { borderColor: theme.surface, borderWidth: 2 },
        label: { show: true, position: "inside", formatter: "{b}: {c}", color: theme.text, overflow: "truncate" },
        data: items.map((d, i) => ({ ...d, label: { color: readableOn(colours[i]!, theme) } })),
      }],
    };
  }

  // ── Box plot ──────────────────────────────────────────────────────────────
  if (kind === "boxplot" && data.box) {
    const [accent] = colourFor(["box"], config, theme);
    return {
      ...common,
      color: [accent!],
      legend: { show: false },
      grid: { ...grid, bottom: (xName ? 28 : 8) + 14 },
      xAxis: { type: "category", data: data.categories, name: xName, nameLocation: "middle", nameGap: 28, axisLine, axisLabel: { hideOverlap: true, color: theme.text } },
      yAxis: { type: "value", name: yName, nameLocation: "end", scale: true, axisLine, splitLine: split, axisLabel: { color: theme.text } },
      series: [
        { name: yName, type: "boxplot", data: data.box.stats, itemStyle: { color: accent, borderColor: theme.text, borderWidth: 1.5 }, tooltip: { confine: true } },
        { name: "Outliers", type: "scatter", data: data.box.outliers, symbolSize: 5, itemStyle: { color: theme.muted, opacity: 0.7 }, tooltip: { show: false }, silent: true },
      ],
    };
  }

  // ── Cartesian: bar family, line family, histogram ─────────────────────────
  const names = data.series.map((s) => s.name);
  const colours = colourFor(names, config, theme);
  const horizontal = kind === "hbar";
  const share = kind === "stacked-100";
  const stacked = kind === "stacked-bar" || share;
  const combo = kind === "combo" && data.series.length > 1;
  // Bar and line: the chosen measures (or the last one) become lines, on a second axis if asked.
  const lineSeries = new Set<number>(combo ? (config.lines.length ? data.series.map((_, i) => i).filter((i) => config.lines.includes(config.y[i] ?? "")) : [data.series.length - 1]) : []);
  const secondary = combo && config.secondaryAxis && lineSeries.size > 0 && lineSeries.size < data.series.length;
  const totals = data.categories.map((_, ci) => data.series.reduce((a, s) => a + Math.max(0, s.values[ci] ?? 0), 0));
  const isLine = kind === "line" || kind === "area" || kind === "multi-line";
  const counts = kind === "histogram" || config.aggregation === "count";
  const category = { type: "category", data: data.categories, name: xName, nameLocation: horizontal ? "end" : "middle", nameGap: 28, axisLine, axisLabel: { hideOverlap: true, color: theme.text }, ...(horizontal ? { inverse: true } : {}), ...(kind === "histogram" ? { axisTick: { alignWithLabel: true } } : {}) };
  const value = { type: "value", name: yName, nameLocation: horizontal ? "middle" : "end", nameGap: 30, axisLine, splitLine: split, axisLabel: { color: theme.text }, ...(counts ? { minInterval: 1 } : {}) };
  const series = data.series.map((s, i) => {
    const asLine = isLine || lineSeries.has(i);
    return {
      name: s.name,
      type: asLine ? "line" : "bar",
      data: share ? s.values.map((v, ci) => (v === null || !totals[ci] ? null : (Math.max(0, v) / totals[ci]!) * 100)) : s.values,
      ...(stacked ? { stack: "total" } : {}),
      ...(kind === "area" ? { areaStyle: { opacity: 0.25 } } : {}),
      ...(secondary && lineSeries.has(i) ? { yAxisIndex: 1 } : {}),
      ...(asLine ? { smooth: config.smooth, symbolSize: 6, connectNulls: false, ...(combo ? { z: 3 } : {}) } : { itemStyle: { borderRadius: horizontal ? [0, 4, 4, 0] : stacked ? 0 : [4, 4, 0, 0] }, ...(kind === "histogram" ? { barCategoryGap: "4%" } : {}) }),
      label: label({ position: stacked ? "inside" : asLine ? "top" : horizontal ? "right" : "top", ...(share ? { formatter: (p: { value: number }) => `${Math.round(p.value)}%` } : {}) }),
      color: colours[i],
    };
  });
  const shareTooltip = share
    ? { tooltip: { show: config.tooltips, trigger: "axis", confine: true, axisPointer: { type: "shadow" }, formatter: (params: { dataIndex: number; seriesName: string; marker: string; value: number | null }[]) => `${params[0] ? data.categories[params[0].dataIndex] : ""}<br/>${params.map((p) => `${p.marker} ${p.seriesName}: ${p.value === null ? "–" : `${Math.round(p.value * 10) / 10}%`} (${data.series.find((s) => s.name === p.seriesName)?.values[p.dataIndex] ?? "–"})`).join("<br/>")}` } }
    : {};
  const yAxis = secondary
    ? [value, { ...value, name: data.series.filter((_, i) => lineSeries.has(i)).map((s) => s.name).join(", "), nameLocation: "end", position: "right", splitLine: { show: false } }]
    : share
      ? { ...value, max: 100, axisLabel: { color: theme.text, formatter: "{value}%" } }
      : value;
  return {
    ...common,
    color: colours,
    legend: legendBase(data.series.length > 1 ? names : []),
    ...shareTooltip,
    grid: secondary ? { ...grid, right: grid.right + 56 } : grid,
    xAxis: horizontal ? (share ? { ...value, max: 100, axisLabel: { color: theme.text, formatter: "{value}%" } } : value) : category,
    yAxis: horizontal ? category : yAxis,
    series,
  };
}

/** Compact figure for a tile: 1,234 → "1.2K", 3,400,000 → "3.4M"; small numbers keep their detail. */
export function formatFigure(v: number | null, prefix = "", suffix = ""): string {
  if (v === null || !Number.isFinite(v)) return "–";
  const abs = Math.abs(v);
  const body = abs >= 10000 ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v) : new Intl.NumberFormat("en", { maximumFractionDigits: abs >= 100 ? 0 : 2 }).format(v);
  return `${prefix}${body}${suffix}`;
}

function kpiOption(data: ChartData, config: ChartConfig, theme: ChartTheme, flags: OptionFlags): EChartsOption {
  const k = data.kpi!;
  const { width: w, height: h } = flags.size ?? { width: 320, height: 180 };
  const value = formatFigure(k.value, config.prefix, config.suffix);
  const label = config.title || k.label;
  // Size the figure to fit: limited by width (about 0.6em per character) and by height.
  const fig = Math.round(Math.min(120, Math.max(24, Math.min((w * 0.86) / Math.max(2, value.length * 0.62), h * 0.42))));
  const small = Math.round(Math.min(18, Math.max(12, h * 0.085)));
  const change = k.change;
  const delta = change === undefined ? (k.period ? "No comparison available" : "") : `${change >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(change * 1000) / 10)}% vs ${k.previousPeriod}`;
  const deltaColour = change === undefined ? theme.muted : change >= 0 ? theme.positive : theme.negative;
  const font = (size: number, weight: number) => `${weight} ${size}px DM Sans, system-ui, sans-serif` // no quotes: ECharts writes this into an SVG attribute unescaped;
  const blockH = small + 8 + fig + (delta ? 10 + small : 0);
  const top = Math.max(4, (h - blockH) / 2);
  const text = (t: string, y: number, size: number, weight: number, fill: string) => ({ type: "text", left: "center", top: y, style: { text: t, fill, font: font(size, weight), textAlign: "center" } });
  return {
    animation: false,
    aria: { enabled: true, label: { enabled: true, description: `${label}: ${value}${delta ? `, ${delta}` : ""}` } },
    textStyle: { fontFamily: "inherit", color: theme.text },
    graphic: { elements: [text(label, top, small, 500, theme.muted), text(value, top + small + 8, fig, 600, theme.text), ...(delta ? [text(delta, top + small + 18 + fig, small, 600, deltaColour)] : [])] },
  };
}
