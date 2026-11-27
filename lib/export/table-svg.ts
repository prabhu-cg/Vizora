import { datasetOf } from "@/lib/charts";
import { buildTableView, fraction, readTableConfig } from "@/lib/tables";
import type { Cell, VisualisationIR } from "@/types/visualisation";
import { EXPORT_THEME as T } from "./svg-theme";
import type { SvgResult } from "./svg";

export const TABLE_IMAGE_MAX_ROWS = 40;
export const TABLE_IMAGE_MAX_COLUMNS = 12;
const PAD = 24, TITLE_H = 44, HEAD_H = 36, ROW_H = 30, FOOT_H = 34;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fit = (s: string, max: number) => (s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s);
const text = (v: Cell): string => (v === null || v === "" ? "" : typeof v === "number" ? new Intl.NumberFormat("en", { maximumFractionDigits: 4 }).format(v) : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));

/**
 * A picture of the table as configured: its visible columns (up to 12), its
 * filters and sort, and the first 40 rows, with colour scales and data bars.
 * A picture cannot scroll, so it says how much it left out.
 */
export function renderTableSvg(doc: VisualisationIR): SvgResult {
  const config = readTableConfig(doc.configuration.options);
  const dataset = datasetOf(doc, config.datasetId);
  if (!dataset || dataset.rows.length === 0) throw new Error("There is no data to show in the table yet. Add a dataset first.");
  const view = buildTableView(dataset, config);
  const cols = view.columns.slice(0, TABLE_IMAGE_MAX_COLUMNS);
  const rows = view.rows.slice(0, TABLE_IMAGE_MAX_ROWS);
  const widths = cols.map((c) => {
    const longest = Math.max(c.label.length, ...rows.map((r) => text(r[c.key] ?? null).length));
    return Math.min(220, Math.max(72, Math.min(longest, 28) * 7.2 + 28));
  });
  const width = Math.ceil(PAD * 2 + widths.reduce((a, b) => a + b, 0) + 40);
  const left = PAD + 40;
  const body = TITLE_H + HEAD_H + rows.length * ROW_H;
  const omitted: string[] = [];
  if (view.rows.length > rows.length) omitted.push(`first ${rows.length} of ${view.rows.length.toLocaleString()} rows`);
  if (view.columns.length > cols.length) omitted.push(`${cols.length} of ${view.columns.length} columns`);
  const height = Math.ceil(PAD + body + (omitted.length ? FOOT_H : PAD));

  const parts: string[] = [];
  parts.push(`<text x="${PAD}" y="${PAD + 16}" font-size="20" font-weight="600" fill="${T.ink}">${esc(doc.title || dataset.name)}</text>`);
  parts.push(`<rect x="${PAD}" y="${PAD + TITLE_H - 8}" width="${width - PAD * 2}" height="${HEAD_H}" fill="${T.desk}" stroke="${T.hairline}"/>`);
  let x = left;
  cols.forEach((c, i) => {
    const w = widths[i]!;
    const right = c.type === "number";
    parts.push(`<text x="${right ? x + w - 10 : x + 10}" y="${PAD + TITLE_H - 8 + 23}" font-size="12.5" font-weight="600" fill="${T.ink}" text-anchor="${right ? "end" : "start"}">${esc(fit(c.label, Math.floor((w - 16) / 7.2)))}</text>`);
    x += w;
  });
  rows.forEach((r, ri) => {
    const y = PAD + TITLE_H - 8 + HEAD_H + ri * ROW_H;
    parts.push(`<rect x="${PAD}" y="${y}" width="${width - PAD * 2}" height="${ROW_H}" fill="${ri % 2 ? T.desk : T.paper}" stroke="${T.hairline}" stroke-width="0.5"/>`);
    parts.push(`<text x="${left - 10}" y="${y + 20}" font-size="11" fill="${T.muted}" text-anchor="end">${ri + 1}</text>`);
    let cx = left;
    cols.forEach((c, i) => {
      const w = widths[i]!;
      const v = r[c.key] ?? null;
      const f = config.formats[c.key];
      const frac = f ? fraction(v, view.ranges[c.key]) : undefined;
      if (frac !== undefined) {
        parts.push(f === "bars" ? `<rect x="${cx + 2}" y="${y + 4}" width="${Math.max(1, (w - 4) * frac)}" height="${ROW_H - 8}" rx="3" fill="${T.amber}" fill-opacity="0.5"/>` : `<rect x="${cx}" y="${y}" width="${w}" height="${ROW_H}" fill="${T.amber}" fill-opacity="${(0.08 + frac * 0.4).toFixed(2)}"/>`);
      }
      const right = c.type === "number";
      parts.push(`<text x="${right ? cx + w - 10 : cx + 10}" y="${y + 20}" font-size="12.5" fill="${T.body}" text-anchor="${right ? "end" : "start"}">${esc(fit(text(v), Math.floor((w - 16) / 7)))}</text>`);
      cx += w;
    });
  });
  if (omitted.length) parts.push(`<text x="${PAD}" y="${height - 12}" font-size="12" fill="${T.muted}">Showing ${esc(omitted.join(" and "))}.</text>`);

  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${esc(T.font)}" role="img" aria-labelledby="t d">` +
    `<title id="t">${esc(doc.title)}</title><desc id="d">Table of ${rows.length} row${rows.length === 1 ? "" : "s"} and ${cols.length} column${cols.length === 1 ? "" : "s"}</desc>` +
    `<rect width="100%" height="100%" fill="${T.paper}"/>${parts.join("")}</svg>`;
  return { svg, width, height };
}
