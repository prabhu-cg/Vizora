import { BarChart, LineChart } from "echarts/charts";
import { AriaComponent, GridComponent, LegendComponent, TitleComponent, TooltipComponent } from "echarts/components";
import { LegacyGridContainLabel } from "echarts/features";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { buildChartOption } from "./option";
import { FALLBACK_CHART_THEME } from "./theme";
import type { VisualisationIR } from "@/types/visualisation";

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, AriaComponent, LegacyGridContainLabel, SVGRenderer]);

export const CHART_EXPORT_SIZE = { width: 960, height: 540 };

/** Render a chart to SVG without touching the DOM (ECharts server-side mode). Always the light theme on white. */
export function renderChartSvg(doc: VisualisationIR): { svg: string; width: number; height: number } {
  const option = buildChartOption(doc, FALLBACK_CHART_THEME, { decal: false });
  if (!option) throw new Error("There is no chartable data yet. Import a CSV or JSON file with a label column and a numeric column.");
  const { width, height } = CHART_EXPORT_SIZE;
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
  try {
    chart.setOption({ ...option, animation: false, backgroundColor: "#ffffff", title: { text: doc.title, left: 8, top: 4, textStyle: { fontSize: 18, fontWeight: 600, color: "#353335" } }, legend: { top: 34, left: 8, textStyle: { color: "#4d4a4d" } }, grid: { left: 12, right: 24, top: 78, bottom: 12, containLabel: true } });
    return { svg: chart.renderToSVGString(), width, height };
  } finally {
    chart.dispose();
  }
}
