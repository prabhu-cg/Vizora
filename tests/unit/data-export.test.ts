import { describe, expect, it } from "vitest";
import { renderDashboardSvg } from "@/features/charts/dashboard-svg";
import { addWidget, chartConfigSchema, emptyDashboard, type Dashboard } from "@/lib/charts";
import { buildDataset, parseCsv, readText } from "@/lib/data";
import { createEntitlementService } from "@/features/entitlements";
import { createExportManager, createPdfExporter, csvChartExporter, csvDatasetExporter, pngExporter, renderSvgFor, svgExporter } from "@/lib/export";
import { createVisualisation } from "@/lib/visualisation/factory";
import type { VisualisationIR } from "@/types/visualisation";

const csv = 'region,channel,units,note\nNorth,web,10,"has, comma"\nNorth,shop,20,=SUM(A1)\nSouth,web,5,plain\nEast,shop,7,"say ""hi"""';
const dataset = (id = "d1") => buildDataset(readText(csv), { name: "Sales" }, () => id).dataset;

function chartDoc(config: object = { kind: "bar", x: "region", y: ["units"] }, title = "Sales by region"): VisualisationIR {
  const ds = dataset();
  const base = createVisualisation({ title, type: "chart" });
  return { ...base, data: { datasets: [ds] }, configuration: { options: { chart: chartConfigSchema.parse({ ...config, datasetId: ds.id }) } } };
}
function dashDoc(configs: object[]): VisualisationIR {
  const ds = dataset();
  let dash: Dashboard = emptyDashboard();
  for (const c of configs) dash = addWidget(dash, chartConfigSchema.parse({ ...c, datasetId: ds.id }), { w: 6, h: 4 }).dashboard;
  const base = createVisualisation({ title: "Quarterly board", type: "dashboard" });
  return { ...base, description: "Sales overview", data: { datasets: [ds] }, configuration: { options: { dashboard: dash } } };
}
const MANY = [
  { kind: "bar", x: "region", y: ["units"], title: "Units" },
  { kind: "donut", x: "channel", y: ["units"], title: "By channel" },
  { kind: "heatmap", x: "region", series: "channel", y: ["units"], title: "Heat" },
];
const parse = (svg: string) => new DOMParser().parseFromString(svg, "image/svg+xml");
const text = async (b: Blob) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(await b.arrayBuffer());

describe("CSV export", () => {
  it("chart data: exactly the table the chart plots", async () => {
    const out = await csvChartExporter.run(chartDoc());
    expect(out.filename).toBe("sales-by-region-chart-data.csv");
    const t = (await text(out.blob)).replace(/^﻿/, "");
    expect(parseCsv(t, ",")).toEqual([["region", "Sum of units"], ["North", "30"], ["South", "5"], ["East", "7"]]);
  });
  it("chart data respects filters, aggregation and sorting", async () => {
    const out = await csvChartExporter.run(chartDoc({ kind: "bar", x: "region", y: ["units"], aggregation: "avg", filters: [{ column: "channel", op: "eq", value: "web" }], sort: { by: "value", dir: "desc" } }));
    expect(parseCsv((await text(out.blob)).replace(/^﻿/, ""), ",")).toEqual([["region", "Average of units"], ["North", "10"], ["South", "5"]]);
  });
  it("dataset: all columns, filtered rows, safely quoted, formulas neutralised, UTF-8 BOM for Excel", async () => {
    const out = await csvDatasetExporter.run(chartDoc({ kind: "bar", x: "region", y: ["units"], filters: [{ column: "units", op: "gte", value: "10" }] }));
    expect(out.filename).toBe("sales.csv");
    const raw = await text(out.blob);
    expect(raw.charCodeAt(0)).toBe(0xfeff);
    expect(raw).toContain("'=SUM(A1)");
    const rows = parseCsv(raw.replace(/^﻿/, ""), ",");
    expect(rows[0]).toEqual(["region", "channel", "units", "note"]);
    expect(rows).toHaveLength(3);
    expect(rows[1]![3]).toBe("has, comma");
  });
  it("dataset CSV is offered for one dataset only; chart CSV only once there is data", () => {
    expect(csvDatasetExporter.supports!(chartDoc())).toBe(true);
    expect(csvDatasetExporter.supports!({ ...chartDoc(), data: { datasets: [dataset("a"), dataset("b")] } })).toBe(false);
    expect(csvChartExporter.supports!(createVisualisation({ title: "x", type: "chart" }))).toBe(false);
  });
  it("explains configurations that cannot be exported", () => {
    expect(() => csvChartExporter.run(chartDoc({ kind: "bar", x: "region", y: ["units"], filters: [{ column: "region", op: "eq", value: "Mars" }] }))).toThrow(/No rows match/);
  });
});

describe("chart image export", () => {
  it("SVG uses the configured title, falling back to the document title", async () => {
    expect(await text((await svgExporter.run(chartDoc({ kind: "bar", x: "region", y: ["units"], title: "Custom" }))).blob)).toContain("Custom");
    expect(await text((await svgExporter.run(chartDoc())).blob)).toContain("Sales by region");
  });
  it("works for a chart that was never configured, using the recommendation", async () => {
    const doc = { ...chartDoc(), configuration: { options: {} } };
    const out = await svgExporter.run(doc);
    expect(parse(await text(out.blob)).querySelector("parsererror")).toBeNull();
  });
});

describe("dashboard export", () => {
  it("composes every tile into one well-formed SVG with unique ids", () => {
    const { svg, width, height } = renderDashboardSvg(dashDoc(MANY));
    const xml = parse(svg);
    expect(xml.querySelector("parsererror")).toBeNull();
    expect(xml.documentElement.getAttribute("viewBox")).toBe(`0 0 ${width} ${height}`);
    expect(xml.querySelector("title")!.textContent).toBe("Quarterly board");
    expect(xml.querySelectorAll("svg > svg")).toHaveLength(3);
    const text = xml.documentElement.textContent!;
    for (const t of ["Quarterly board", "Sales overview", "Units", "By channel", "Heat"]) expect(text).toContain(t);
    const ids = [...xml.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("a tile that cannot be drawn says why instead of vanishing", () => {
    const { svg } = renderDashboardSvg(dashDoc([...MANY.slice(0, 1), { kind: "scatter", x: "region", y: ["units"], title: "Broken" }]));
    expect(svg).toMatch(/numeric column for X/);
  });
  it("refuses an empty dashboard with guidance", () => {
    expect(() => renderDashboardSvg(createVisualisation({ title: "E", type: "dashboard" }))).toThrow(/no charts on this dashboard/);
  });
  it("PNG: a real image at the dashboard's size", async () => {
    type Sharp = (b: Buffer) => { png(): { toBuffer(): Promise<Buffer> }; metadata(): Promise<{ width: number; height: number }> };
    const sharp = (await import("sharp")).default as unknown as Sharp;
    const { svg, width, height } = await renderSvgFor(dashDoc(MANY));
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const meta = await sharp(png).metadata();
    expect(Math.abs(meta.width - width)).toBeLessThanOrEqual(2);
    expect(Math.abs(meta.height - height)).toBeLessThanOrEqual(2);
  });
  it("PDF: a valid single-page document sized to the dashboard", async () => {
    type Sharp = (b: Buffer) => { png(): { toBuffer(): Promise<Buffer> } };
    const sharp = (await import("sharp")).default as unknown as Sharp;
    const exporter = createPdfExporter(renderSvgFor, async (svg) => new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer()));
    const doc = dashDoc(MANY);
    const out = await exporter.run(doc);
    expect(out.filename).toBe("quarterly-board.pdf");
    expect(out.blob.type).toBe("application/pdf");
    const raw = new TextDecoder("latin1").decode(await out.blob.arrayBuffer());
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw.trimEnd().endsWith("%%EOF")).toBe(true);
    expect((raw.match(/\/Type\s*\/Page\b/g) ?? []).length).toBe(1);
    const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(raw)!;
    expect(Number(box[1])).toBeCloseTo(842, 0);
    const { width, height } = renderDashboardSvg(doc);
    expect(Number(box[2]) / Number(box[1])).toBeCloseTo(height / width, 2);
    expect(raw).toContain("/Title (Quarterly board)");
  });
});

describe("what each document type can export", () => {
  const m = createExportManager(createEntitlementService());
  const ids = (d: VisualisationIR) => m.available(d).map((e) => e.id);
  it("chart", () => expect(ids(chartDoc())).toEqual(["png", "svg", "html-embed", "csv-chart", "csv-dataset", "vizora-json"]));
  it("dashboard", () => expect(ids(dashDoc(MANY))).toEqual(["png", "svg", "html-embed", "pdf", "csv-dataset", "vizora-json"]));
  it("an empty chart or dashboard can still be saved as JSON, and nothing else", () => {
    expect(ids(createVisualisation({ title: "c", type: "chart" }))).toEqual(["vizora-json"]);
    expect(ids(createVisualisation({ title: "d", type: "dashboard" }))).toEqual(["vizora-json"]);
  });
  it("the editable JSON round-trips a dashboard exactly", async () => {
    const doc = dashDoc(MANY);
    const { blob } = await m.export("vizora-json", doc);
    const { parseVisualisation } = await import("@/lib/visualisation/migrations");
    expect(parseVisualisation(JSON.parse(await text(blob)))).toEqual(doc);
  });
  it("PNG export is the right call for pngExporter", () => expect(pngExporter.id).toBe("png"));
});
