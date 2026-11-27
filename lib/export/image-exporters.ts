import { readDashboard, resolveChart } from "@/lib/charts";
import { isEngineType } from "@/lib/engine/semantics";
import type { VisualisationIR } from "@/types/visualisation";
import { createPdfExporter } from "./pdf";
import { svgToPng } from "./png";
import { slugify } from "./slug";
import { renderDiagramSvg, type SvgResult } from "./svg";
import type { Exporter } from "./types";

const drawable = (d: VisualisationIR) => isEngineType(d.type) || (d.type === "chart" && d.data.datasets.length > 0) || (d.type === "dashboard" && readDashboard(d.configuration.options).widgets.length > 0);

/** Chart rendering pulls in ECharts, so it is loaded only when a chart is actually exported. */
export async function renderSvgFor(doc: VisualisationIR): Promise<SvgResult> {
  if (doc.type === "chart") {
    const resolved = resolveChart(doc);
    if (!resolved) throw new Error("There is no data to chart yet. Add a dataset first.");
    return (await import("@/features/charts/svg")).renderChartSvg(resolved.dataset, { ...resolved.config, title: resolved.config.title || doc.title });
  }
  if (doc.type === "dashboard") return (await import("@/features/charts/dashboard-svg")).renderDashboardSvg(doc);
  return renderDiagramSvg(doc);
}

export const svgExporter: Exporter = {
  id: "svg",
  label: "SVG image",
  description: "Scalable vector image with your colours and shapes.",
  feature: "export.svg",
  supports: drawable,
  async run(doc) {
    const { svg } = await renderSvgFor(doc);
    return { filename: `${slugify(doc.title)}.svg`, blob: new Blob([svg], { type: "image/svg+xml" }) };
  },
};

export const pngExporter: Exporter = {
  id: "png",
  label: "PNG image",
  description: "Picture at twice the screen resolution, on white.",
  feature: "export.png",
  supports: drawable,
  async run(doc) {
    const { svg, width, height } = await renderSvgFor(doc);
    return { filename: `${slugify(doc.title)}.png`, blob: await svgToPng(svg, width, height, 2) };
  },
};

export const pdfExporter = createPdfExporter(renderSvgFor, (svg, w, h, scale) => svgToPng(svg, w, h, scale));
