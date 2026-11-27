import { GRID_COLUMNS, ROW_PX, datasetOf, readDashboard, gridHeightRows } from "@/lib/charts";
import { EXPORT_THEME as T } from "@/lib/export/svg-theme";
import type { VisualisationIR } from "@/types/visualisation";
import { renderChartSvg, type ChartSvg } from "./svg";

const W = 1280;
const MARGIN = 28;
const GAP = 14;
const HEADER = 76;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Re-home a chart's SVG at (x, y) inside a larger one. ECharts ids are prefixed per tile so nine charts never share an id. */
function nest(svg: string, index: number, x: number, y: number, w: number, h: number): string {
  const m = /<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>\s*$/.exec(svg);
  if (!m) return "";
  const inner = m[2]!.replace(/zr0-/g, `zr${index}-`);
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${m[1]}">${inner}</svg>`;
}

/**
 * Compose a whole dashboard into one SVG that mirrors the grid, drawn from
 * the document alone (no screen needed). Each tile is a real chart; a tile
 * that cannot be drawn says why instead of being left blank.
 */
export function renderDashboardSvg(doc: VisualisationIR): ChartSvg {
  const dash = readDashboard(doc.configuration.options);
  if (dash.widgets.length === 0) throw new Error("There are no charts on this dashboard yet. Add one first.");
  const col = (W - MARGIN * 2) / GRID_COLUMNS;
  const rows = gridHeightRows(dash.widgets);
  const height = Math.ceil(HEADER + rows * ROW_PX + MARGIN);

  const tiles = dash.widgets.map((w, i) => {
    const x = MARGIN + w.x * col + GAP / 2;
    const y = HEADER + w.y * ROW_PX + GAP / 2;
    const pw = Math.round(w.w * col - GAP);
    const ph = Math.round(w.h * ROW_PX - GAP);
    const card = `<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="14" fill="${T.paper}" stroke="${T.hairline}"/>`;
    const dataset = datasetOf(doc, w.chart.datasetId);
    try {
      if (!dataset) throw new Error("This chart's data is missing.");
      const c = renderChartSvg(dataset, w.chart, { width: pw - 16, height: ph - 12 });
      return card + nest(c.svg, i, x + 8, y + 6, pw - 16, ph - 12);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "This chart could not be drawn.";
      return card + `<text x="${x + 16}" y="${y + 30}" font-size="14" fill="${T.muted}">${esc(msg.slice(0, 90))}</text>`;
    }
  });

  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" font-family="${esc(T.font)}" role="img" aria-labelledby="t d">` +
    `<title id="t">${esc(doc.title)}</title><desc id="d">Dashboard with ${dash.widgets.length} chart${dash.widgets.length === 1 ? "" : "s"}</desc>` +
    `<rect width="100%" height="100%" fill="${T.desk}"/>` +
    `<text x="${MARGIN}" y="${MARGIN + 22}" font-size="26" font-weight="600" fill="${T.ink}">${esc(doc.title)}</text>` +
    (doc.description ? `<text x="${MARGIN}" y="${MARGIN + 46}" font-size="14" fill="${T.muted}">${esc(doc.description.slice(0, 160))}</text>` : "") +
    tiles.join("") +
    `</svg>`;
  return { svg, width: W, height };
}
