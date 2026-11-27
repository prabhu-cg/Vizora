import { chartPalette, brand } from "@/lib/design/tokens";
import type { Dataset, VisualisationIR } from "@/types/visualisation";

export type ChartKind = "bar" | "line";

/** The slice of the IR a chart depends on, so unrelated edits (e.g. title) do not rebuild it. */
export type ChartInput = Pick<VisualisationIR, "data" | "configuration">;

export function chartKindOf(doc: ChartInput): ChartKind {
  return doc.configuration.options.chartKind === "line" ? "line" : "bar";
}

export interface ChartSelection {
  dataset: Dataset;
  categoryKey: string;
  valueKeys: string[];
}

/** Choose the first dataset with a label column and at least one numeric column. */
export function selectChartData(doc: ChartInput): ChartSelection | undefined {
  for (const dataset of doc.data.datasets) {
    const numeric = dataset.columns.filter((c) => c.type === "number");
    const category =
      dataset.columns.find((c) => c.type === "string" || c.type === "date") ??
      dataset.columns.find((c) => c.type !== "number");
    if (category && numeric.length > 0) {
      return { dataset, categoryKey: category.key, valueKeys: numeric.map((c) => c.key) };
    }
  }
  return undefined;
}

/** Pure IR → ECharts option. Returns undefined when no dataset is chartable. */
export function buildChartOption(doc: ChartInput): Record<string, unknown> | undefined {
  const selection = selectChartData(doc);
  if (!selection) return undefined;
  const { dataset, categoryKey, valueKeys } = selection;
  const kind = chartKindOf(doc);
  const labelOf = (key: string) => dataset.columns.find((c) => c.key === key)?.label ?? key;

  return {
    color: [...chartPalette],
    aria: { enabled: true, decal: { show: true } },
    animation: !(typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches),
    textStyle: { fontFamily: "inherit", color: brand.charcoal },
    tooltip: { trigger: "axis" },
    legend: valueKeys.length > 1 ? { top: 0 } : undefined,
    grid: { left: 8, right: 16, top: valueKeys.length > 1 ? 40 : 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: dataset.rows.map((r) => String(r[categoryKey] ?? "")),
      axisLine: { lineStyle: { color: brand.border } },
    },
    yAxis: { type: "value", splitLine: { lineStyle: { color: brand.border } } },
    series: valueKeys.map((key) => ({
      name: labelOf(key),
      type: kind,
      data: dataset.rows.map((r) => r[key] ?? null),
      ...(kind === "line" ? { smooth: false, symbolSize: 6 } : { itemStyle: { borderRadius: [4, 4, 0, 0] } }),
    })),
  };
}
