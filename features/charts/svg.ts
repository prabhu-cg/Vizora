import { runChartQuery, type ChartConfig } from "@/lib/charts";
import type { Dataset } from "@/types/visualisation";
import { buildEChartsOption } from "./echarts-option";
import { echarts } from "./echarts-setup";
import { FALLBACK_CHART_THEME } from "./theme";

export const CHART_EXPORT_SIZE = { width: 960, height: 540 };

export interface ChartSvg {
  svg: string;
  width: number;
  height: number;
}

/**
 * Render a chart to SVG without touching the DOM (ECharts server-side mode).
 * Always the light theme on white, so an exported file reads the same anywhere.
 */
export function renderChartSvg(dataset: Dataset, config: ChartConfig, size: { width: number; height: number } = CHART_EXPORT_SIZE): ChartSvg {
  const result = runChartQuery(dataset, config);
  if (!result.ok) throw new Error(result.error);
  const { width, height } = size;
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
  try {
    chart.setOption({ ...buildEChartsOption(result.data, config, FALLBACK_CHART_THEME, { decal: false, animate: false, size: { width, height } }), backgroundColor: FALLBACK_CHART_THEME.surface });
    return { svg: chart.renderToSVGString(), width, height };
  } finally {
    chart.dispose();
  }
}
