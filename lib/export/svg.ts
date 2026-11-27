import { edgeGeometry, rectOf, type Rect } from "@/lib/engine/edges";
import { hiddenNodeIds } from "@/lib/engine/ops";
import { formatDateValue } from "@/lib/engine/interpret/dates";
import { LINE_H, textColumns } from "@/lib/engine/layout/size";
import { applyLayout, laneGeometry, timelineGeometry, withLanePositions } from "@/lib/engine";
import { getColor, getExtras, isDirected, isEngineType } from "@/lib/engine/semantics";
import { wrapText } from "@/lib/engine/text";
import type { IRNode, VisualisationIR } from "@/types/visualisation";
import { EXPORT_THEME as T, tint } from "./svg-theme";

export interface SvgResult {
  svg: string;
  width: number;
  height: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n2 = (n: number) => Math.round(n * 100) / 100;
const PAD = 48;
const TITLE_H = 52;

function lines(x: number, y: number, rows: string[], opts: { size?: number; lh?: number; weight?: number; fill?: string; anchor?: "middle" | "start" } = {}): string {
  const { size = 14, lh = LINE_H, weight = 400, fill = T.ink, anchor = "middle" } = opts;
  return (
    `<text x="${n2(x)}" y="${n2(y)}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}">` +
    rows.map((r, i) => `<tspan x="${n2(x)}" dy="${i === 0 ? 0 : lh}">${esc(r)}</tspan>`).join("") +
    `</text>`
  );
}

/** Vertical centre for a block of `count` text lines. */
const blockTop = (r: Rect, count: number, lh = LINE_H) => r.y + r.height / 2 - ((count - 1) * lh) / 2 + 5;

function shape(doc: VisualisationIR, n: IRNode, r: Rect): string {
  const colour = T.colours[getColor(n)];
  const hasColour = getColor(n) !== "default";
  const stroke = colour;
  const fill = hasColour ? tint(colour, 0.84) : T.paper;
  const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${hasColour ? 2 : 1.5}"`;
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const cols = textColumns(r.width);
  const label = (rows: string[], extra = {}) => lines(cx, blockTop(r, rows.length), rows, extra);

  if (doc.type === "timeline") return ""; // timeline cards are drawn by drawTimeline

  switch (n.type) {
    case "decision": {
      const rows = wrapText(n.label, textColumns(r.width * 0.62), 4);
      return `<polygon points="${cx},${r.y} ${r.x + r.width},${cy} ${cx},${r.y + r.height} ${r.x},${cy}" ${attrs}/>${label(rows)}`;
    }
    case "io": {
      const k = 16;
      const rows = wrapText(n.label, textColumns(r.width - 2 * k), 4);
      return `<polygon points="${r.x + k},${r.y} ${r.x + r.width},${r.y} ${r.x + r.width - k},${r.y + r.height} ${r.x},${r.y + r.height}" ${attrs}/>${label(rows)}`;
    }
    case "start":
    case "end": {
      const f = hasColour ? fill : tint(T.amber, 0.78);
      const s = hasColour ? stroke : T.amberDeep;
      return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${r.height / 2}" fill="${f}" stroke="${s}" stroke-width="1.5"/>${label(wrapText(n.label, cols, 1), { weight: 600 })}`;
    }
    case "topic": {
      return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${Math.min(28, r.height / 2)}" fill="${T.amber}" stroke="${T.amberDeep}" stroke-width="1.5"/>${label(wrapText(n.label, cols, 3), { weight: 600 })}`;
    }
    case "branch":
      return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${r.height / 2.2}" ${attrs}/>${label(wrapText(n.label, cols, 4))}`;
    case "concept":
      return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${Math.min(22, r.height / 2)}" ${attrs}/>${label(wrapText(n.label, cols, 4))}`;
    default:
      return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="8" ${attrs}/>${label(wrapText(n.label, cols, 4))}`;
  }
}

function drawEdges(doc: VisualisationIR, nodes: Map<string, IRNode>, hidden: Set<string>): string {
  const out: string[] = [];
  for (const e of doc.edges) {
    const a = nodes.get(e.source), b = nodes.get(e.target);
    if (!a || !b || hidden.has(a.id) || hidden.has(b.id)) continue;
    const g = edgeGeometry(rectOf(a), rectOf(b));
    const colour = doc.type === "mindmap" ? T.colours[getColor(b) === "default" ? "grey" : getColor(b)] : T.muted;
    const width = doc.type === "mindmap" ? 2.2 : 1.6;
    let svg = `<g data-edge="${esc(e.id)}"><path d="${g.path}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round"/>`;
    if (isDirected(e, doc.type)) {
      const { x, y } = g.to;
      const t = g.tip;
      const s = 9;
      const p = (k: number) => `${n2(x - t.x * s + -t.y * k)},${n2(y - t.y * s + t.x * k)}`;
      svg += `<polygon points="${n2(x)},${n2(y)} ${p(4.5)} ${p(-4.5)}" fill="${colour}"/>`;
    }
    if (e.label) {
      const w = Math.max(24, e.label.length * 6.8 + 14);
      svg += `<rect x="${n2(g.mid.x - w / 2)}" y="${n2(g.mid.y - 11)}" width="${n2(w)}" height="22" rx="11" fill="${T.paper}" stroke="${T.hairline}"/>` + lines(g.mid.x, g.mid.y + 4, [e.label], { size: 12, fill: T.body });
    }
    out.push(svg + "</g>");
  }
  return out.join("");
}

function drawTimeline(doc: VisualisationIR): { body: string; bounds: Rect } {
  const geo = timelineGeometry(doc);
  const horizontal = doc.layout.direction !== "TB" && doc.layout.direction !== "BT";
  const parts: string[] = [`<line x1="${geo.axis.x1}" y1="${geo.axis.y1}" x2="${geo.axis.x2}" y2="${geo.axis.y2}" stroke="${T.control}" stroke-width="4" stroke-linecap="round"/>`];
  let minX = geo.axis.x1, minY = geo.axis.y1, maxX = geo.axis.x2, maxY = geo.axis.y2;
  for (const n of doc.nodes) {
    const r = rectOf({ ...n, position: geo.positions.get(n.id) ?? n.position });
    const ex = getExtras(n);
    const colour = T.colours[getColor(n)];
    const accent = getColor(n) === "default" ? T.control : colour;
    const milestone = n.type === "milestone";
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const before = geo.sides.get(n.id) === "before";
    // stem and marker
    const sx = horizontal ? cx : before ? r.x + r.width : r.x;
    const sy = horizontal ? (before ? r.y + r.height : r.y) : cy;
    const ax = horizontal ? cx : 0, ay = horizontal ? 0 : cy;
    parts.push(`<line x1="${n2(sx)}" y1="${n2(sy)}" x2="${n2(ax)}" y2="${n2(ay)}" stroke="${accent}" stroke-width="2"/>`);
    parts.push(
      milestone
        ? `<polygon points="${ax},${ay - 9} ${ax + 9},${ay} ${ax},${ay + 9} ${ax - 9},${ay}" fill="${T.amber}" stroke="${T.amberDeep}" stroke-width="1.5"/>`
        : `<circle cx="${n2(ax)}" cy="${n2(ay)}" r="6.5" fill="${T.paper}" stroke="${accent}" stroke-width="3"/>`,
    );
    // card
    const dateText = ex.dateLabel ?? (ex.date ? formatDateValue(ex.date) : "");
    const cols = textColumns(r.width);
    const titleRows = wrapText(n.label, cols, 3);
    const descRows = ex.description ? wrapText(ex.description, cols, 3) : [];
    parts.push(
      `<g data-node="${esc(n.id)}"><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="12" fill="${getColor(n) === "default" ? T.paper : tint(colour, 0.86)}" stroke="${accent}" stroke-width="${milestone ? 2.5 : 1.5}"/>`,
    );
    let y = r.y + 22;
    if (dateText) parts.push(lines(r.x + 14, y - 2, [dateText.length > 0 ? dateText : ""], { size: 11.5, weight: 600, fill: T.muted, anchor: "start" }));
    y = r.y + 22 + (dateText ? 0 : -4);
    const titleY = dateText ? r.y + 42 : r.y + 26;
    parts.push(lines(r.x + 14, titleY, titleRows, { weight: 600, anchor: "start" }));
    if (descRows.length) parts.push(lines(r.x + 14, titleY + titleRows.length * LINE_H + 4, descRows, { size: 12, lh: 17, fill: T.body, anchor: "start" }));
    parts.push(`</g>`);
    void y;
    minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width); maxY = Math.max(maxY, r.y + r.height);
  }
  return { body: parts.join(""), bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } };
}

/**
 * Render a flowchart, mind map, concept map or timeline to a standalone SVG
 * from the IR alone. Colours and shapes come from the document's own styling;
 * hidden (collapsed) mind-map branches stay hidden.
 */
export function renderDiagramSvg(input: VisualisationIR): SvgResult {
  if (!isEngineType(input.type)) throw new Error("This type is not drawn from nodes.");
  if (input.nodes.length === 0) throw new Error("There is nothing to export yet. Add something to the visualisation first.");
  // Make sure sizes exist even for documents that were never laid out in this session.
  const sized = input.nodes.every((n) => n.size) ? input : applyLayout(input);
  // With swimlanes, steps sit where their lane puts them, exactly as on screen.
  const doc = withLanePositions(sized);
  const lanes = laneGeometry(sized);
  const hidden = hiddenNodeIds(doc);
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]));

  let body: string;
  let bounds: Rect;
  if (doc.type === "timeline") {
    ({ body, bounds } = drawTimeline(doc));
  } else {
    const visible = doc.nodes.filter((n) => !hidden.has(n.id));
    const rects = visible.map((n) => rectOf(n));
    const minX = Math.min(...rects.map((r) => r.x)), minY = Math.min(...rects.map((r) => r.y));
    const maxX = Math.max(...rects.map((r) => r.x + r.width)), maxY = Math.max(...rects.map((r) => r.y + r.height));
    bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    let bands = "";
    if (lanes) {
      const a0 = lanes.along.start, len = lanes.along.end - lanes.along.start;
      const last = lanes.bands[lanes.bands.length - 1]!;
      bands = lanes.bands
        .map((b) => {
          const x = lanes.horizontal ? a0 : b.start, y = lanes.horizontal ? b.start : a0;
          const w = lanes.horizontal ? len : b.size, h = lanes.horizontal ? b.size : len;
          const fill = b.index % 2 === 0 ? T.desk : tint(T.hairline, 0.7);
          const label = esc(b.name.length > 28 ? `${b.name.slice(0, 27)}…` : b.name);
          return `<g data-lane="${esc(b.name)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${T.hairline}"/><text x="${x + 12}" y="${y + 20}" font-size="12.5" font-weight="600" fill="${T.ink}">${label}</text></g>`;
        })
        .join("");
      // The bands, not just the steps, decide how big the picture is.
      const x0 = lanes.horizontal ? a0 : 0, y0 = lanes.horizontal ? 0 : a0;
      const x1 = lanes.horizontal ? a0 + len : last.start + last.size, y1 = lanes.horizontal ? last.start + last.size : a0 + len;
      bounds = { x: Math.min(minX, x0), y: Math.min(minY, y0), width: Math.max(maxX, x1) - Math.min(minX, x0), height: Math.max(maxY, y1) - Math.min(minY, y0) };
    }
    body =
      bands +
      drawEdges(doc, nodes, hidden) +
      visible.map((n) => `<g data-node="${esc(n.id)}">${shape(doc, n, rectOf(n))}</g>`).join("");
  }

  const width = Math.ceil(Math.max(bounds.width + PAD * 2, 320));
  const height = Math.ceil(bounds.height + PAD * 2 + TITLE_H);
  const tx = PAD - bounds.x + (width - (bounds.width + PAD * 2)) / 2;
  const ty = PAD + TITLE_H - bounds.y;
  const desc = `${doc.type} with ${doc.nodes.length - hidden.size} item${doc.nodes.length - hidden.size === 1 ? "" : "s"} and ${doc.edges.length} connection${doc.edges.length === 1 ? "" : "s"}`;
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${esc(T.font)}" role="img" aria-labelledby="t d">` +
    `<title id="t">${esc(doc.title)}</title><desc id="d">${esc(desc)}</desc>` +
    `<rect width="100%" height="100%" fill="${T.paper}"/>` +
    `<text x="${PAD}" y="${PAD - 6}" font-size="22" font-weight="600" fill="${T.ink}">${esc(doc.title)}</text>` +
    `<g transform="translate(${n2(tx)} ${n2(ty)})">${body}</g>` +
    `</svg>`;
  return { svg, width, height };
}
