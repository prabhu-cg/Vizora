import { readDashboard } from "@/lib/charts";
import type { Exporter } from "./types";
import { slugify } from "./slug";
import type { SvgResult } from "./svg";

export type Rasterise = (svg: string, width: number, height: number, scale?: number) => Promise<Blob | Uint8Array>;

const PAGE_WIDTH_PT = 842; // A4 landscape width
const MAX_PAGE_PT = 14_000; // PDF viewers are reliable up to ~14,400 units

/**
 * Build a one-page PDF from a rendered SVG. The page is as wide as A4
 * landscape and as tall as the dashboard needs, so nothing is cropped or
 * split mid-chart. Charts are embedded as 2× images.
 */
export async function svgToPdf(svg: SvgResult, title: string, rasterise: Rasterise): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const png = await rasterise(svg.svg, svg.width, svg.height, 2);
  const bytes = png instanceof Uint8Array ? png : new Uint8Array(await png.arrayBuffer());
  let scale = PAGE_WIDTH_PT / svg.width;
  if (svg.height * scale > MAX_PAGE_PT) scale = MAX_PAGE_PT / svg.height;
  const w = svg.width * scale, h = svg.height * scale;
  const doc = new jsPDF({ orientation: w >= h ? "landscape" : "portrait", unit: "pt", format: [w, h], compress: true });
  doc.setProperties({ title, creator: "Vizora" });
  doc.addImage(bytes, "PNG", 0, 0, w, h);
  return doc.output("blob");
}

export function createPdfExporter(render: (doc: import("@/types/visualisation").VisualisationIR) => Promise<SvgResult>, rasterise: Rasterise): Exporter {
  return {
    id: "pdf",
    label: "PDF document",
    description: "The whole dashboard on one page.",
    feature: "export.pdf",
    supports: (d) => d.type === "dashboard" && readDashboard(d.configuration.options).widgets.length > 0,
    async run(doc) {
      return { filename: `${slugify(doc.title, "dashboard")}.pdf`, blob: await svgToPdf(await render(doc), doc.title, rasterise) };
    },
  };
}
