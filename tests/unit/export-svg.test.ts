import { describe, expect, it, vi } from "vitest";
import { addDatasetToVisualisation } from "@/features/data-import";
import { documentFromInterpretation, getColor, interpret, setStyle, toggleCollapse, updateNode, type EngineType } from "@/lib/engine";
import { createExportManager, pngExporter, renderDiagramSvg, svgExporter, svgToPng } from "@/lib/export";
import { createEntitlementService } from "@/features/entitlements";
import { ingest } from "@/lib/parsers";
import { createVisualisation } from "@/lib/visualisation/factory";
import type { VisualisationIR } from "@/types/visualisation";

const make = (text: string, type: EngineType): VisualisationIR => documentFromInterpretation(text, interpret(text, { type }));
const SAMPLES: Record<EngineType, string> = {
  flowchart: "1. Sign up\n2. If verified, activate, otherwise resend\n3. Input: welcome <b>&</b> \"quotes\"",
  mindmap: "Create a mind map for Launch\n- Marketing\n  - Website\n- Product\n  - Pricing",
  conceptmap: "Customers sign contracts\nSuppliers supply products",
  timeline: "2026-01-01: Kick-off — scope\n2026-02-01: Build [Eng]\n2026-03-01: Launch",
};
const parse = (svg: string) => new DOMParser().parseFromString(svg, "image/svg+xml");

describe("SVG export", () => {
  for (const type of Object.keys(SAMPLES) as EngineType[]) {
    it(`${type}: is well-formed XML with every node, edge and label`, () => {
      const doc = make(SAMPLES[type], type);
      const { svg, width, height } = renderDiagramSvg(doc);
      const xml = parse(svg);
      expect(xml.querySelector("parsererror"), svg.slice(0, 200)).toBeNull();
      const root = xml.documentElement;
      expect(root.tagName).toBe("svg");
      expect(root.getAttribute("viewBox")).toBe(`0 0 ${width} ${height}`);
      expect(xml.querySelector("title")!.textContent).toBe(doc.title);
      expect(xml.querySelectorAll("[data-node]")).toHaveLength(doc.nodes.length);
      expect(xml.querySelectorAll("[data-edge]")).toHaveLength(type === "timeline" ? 0 : doc.edges.length);
      const text = xml.documentElement.textContent!;
      for (const n of doc.nodes) expect(text).toContain(n.label.split(" ")[0]!);
      expect(width).toBeGreaterThan(300);
      expect(height).toBeGreaterThan(100);
    });
  }

  it("escapes markup in labels so exports cannot be broken or injected into", () => {
    const { svg } = renderDiagramSvg(make(SAMPLES.flowchart, "flowchart"));
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("&lt;b&gt;");
    expect(parse(svg).querySelector("parsererror")).toBeNull();
  });

  it("preserves styling: colours, shapes and edge labels survive", () => {
    let doc = make(SAMPLES.flowchart, "flowchart");
    const id = doc.nodes.find((n) => n.label === "Sign up")!.id;
    doc = setStyle(doc, [id], "green");
    const xml = parse(renderDiagramSvg(doc).svg);
    const g = xml.querySelector(`[data-node="${id}"]`)!;
    expect(g.innerHTML).toContain("#146c43");
    expect(xml.querySelectorAll("polygon").length).toBeGreaterThan(0); // decision diamond / io parallelogram
    const text = xml.documentElement.textContent!;
    expect(text).toContain("Yes");
    expect(text).toContain("No");
  });

  it("draws arrowheads for directed edges only", () => {
    const flow = parse(renderDiagramSvg(make(SAMPLES.flowchart, "flowchart")).svg);
    const mind = parse(renderDiagramSvg(make(SAMPLES.mindmap, "mindmap")).svg);
    expect(flow.querySelectorAll("[data-edge] polygon").length).toBe(flow.querySelectorAll("[data-edge]").length);
    expect(mind.querySelectorAll("[data-edge] polygon").length).toBe(0);
  });

  it("mind maps omit collapsed branches", () => {
    let doc = make(SAMPLES.mindmap, "mindmap");
    const m = doc.nodes.find((n) => n.label === "Marketing")!.id;
    doc = toggleCollapse(doc, m);
    const xml = parse(renderDiagramSvg(doc).svg);
    expect(xml.documentElement.textContent).not.toContain("Website");
    expect(xml.documentElement.textContent).toContain("Marketing");
  });

  it("timelines show dates, descriptions and milestone markers", () => {
    const xml = parse(renderDiagramSvg(make(SAMPLES.timeline, "timeline")).svg);
    const text = xml.documentElement.textContent!;
    expect(text).toContain("2026-01-01");
    expect(text).toContain("scope");
    expect(xml.querySelectorAll("polygon").length).toBeGreaterThan(0); // milestone diamonds
  });

  it("vertical timelines export too", () => {
    const doc = { ...make(SAMPLES.timeline, "timeline") };
    const v = documentFromInterpretation(SAMPLES.timeline, interpret(SAMPLES.timeline, { type: "timeline" }), { ...doc, layout: { ...doc.layout, direction: "TB" } });
    expect(parse(renderDiagramSvg(v).svg).querySelector("parsererror")).toBeNull();
  });

  it("is deterministic and reflects edits", () => {
    const doc = make(SAMPLES.flowchart, "flowchart");
    expect(renderDiagramSvg(doc).svg).toBe(renderDiagramSvg(doc).svg);
    const id = doc.nodes.find((n) => n.label === "Sign up")!.id;
    expect(renderDiagramSvg(updateNode(doc, id, { label: "Register" })).svg).toContain("Register");
    expect(getColor(doc.nodes[0]!)).toBe("default");
  });

  it("refuses to export an empty visualisation with a helpful message", () => {
    expect(() => renderDiagramSvg(createVisualisation({ title: "Empty", type: "flowchart" }))).toThrow(/nothing to export/i);
  });
});

describe("chart export", () => {
  const chart = () => addDatasetToVisualisation(createVisualisation({ title: "Sales", type: "chart" }), ingest({ name: "s.csv", text: "Month,Revenue\nJan,10\nFeb,14\nMar,9" }));

  it("renders an SVG with the title and data", async () => {
    const art = await svgExporter.run(chart());
    expect(art.filename).toBe("sales.svg");
    const svg = await art.blob.text();
    expect(parse(svg).querySelector("parsererror")).toBeNull();
    expect(svg).toContain("Sales");
    expect(svg).toContain("Revenue");
  });
  it("explains when there is no chartable data", async () => {
    await expect(svgExporter.run(createVisualisation({ title: "Empty", type: "chart" }))).rejects.toThrow(/no chartable data/i);
  });
});

describe("PNG export", () => {
  it("produces a real PNG of the right size (rasterised with librsvg)", async () => {
    type Sharp = (input: Buffer) => { png(): { toBuffer(): Promise<Buffer> }; metadata(): Promise<{ width: number; height: number }> };
    let sharp: Sharp;
    try {
      sharp = (await import("sharp")).default as unknown as Sharp;
    } catch {
      return; // sharp is optional here; the browser path is covered by the mocked test below
    }
    const { svg, width, height } = renderDiagramSvg(make(SAMPLES.mindmap, "mindmap"));
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const meta = await sharp(png).metadata();
    expect(Math.abs(meta.width - width)).toBeLessThanOrEqual(2);
    expect(Math.abs(meta.height - height)).toBeLessThanOrEqual(2);
  });

  it("rasterises in the browser on a white background at 2x, clamped to canvas limits", async () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const calls: Record<string, unknown[]> = { fill: [], draw: [] };
    const ctx = { fillStyle: "", fillRect: (...a: unknown[]) => calls.fill.push(a), drawImage: (...a: unknown[]) => calls.draw.push(a) };
    const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (cb: (b: Blob) => void) => cb(new Blob(["png"], { type: "image/png" })) } as unknown as HTMLCanvasElement;
    const img = { set src(_v: string) { queueMicrotask(() => (img as unknown as { onload?: () => void }).onload?.()); }, onload: undefined as undefined | (() => void), onerror: undefined } as unknown as HTMLImageElement;
    const blob = await svgToPng("<svg/>", 400, 300, 2, { createImage: () => img, createCanvas: () => canvas });
    expect(blob.type).toBe("image/png");
    expect([canvas.width, canvas.height]).toEqual([800, 600]);
    expect(ctx.fillStyle).toBe("#ffffff");
    expect(calls.fill).toHaveLength(1);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    const big = await svgToPng("<svg/>", 20000, 100, 2, { createImage: () => img, createCanvas: () => canvas });
    expect(big).toBeTruthy();
    expect(canvas.width).toBeLessThanOrEqual(8192);
  });

  it("reports render failures instead of hanging", async () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const img = { set src(_v: string) { queueMicrotask(() => (img as unknown as { onerror?: () => void }).onerror?.()); }, onload: undefined, onerror: undefined as undefined | (() => void) } as unknown as HTMLImageElement;
    await expect(svgToPng("<svg/>", 10, 10, 2, { createImage: () => img })).rejects.toThrow(/could not be rendered/);
  });
});

describe("export manager", () => {
  it("offers PNG, SVG and JSON for drawable types, and only JSON for tables", () => {
    const m = createExportManager(createEntitlementService());
    expect(m.available(make(SAMPLES.timeline, "timeline")).map((e) => e.id)).toEqual(["png", "svg", "vizora-json"]);
    expect(m.available(createVisualisation({ title: "T", type: "table" })).map((e) => e.id)).toEqual(["vizora-json"]);
    expect(pngExporter.supports!(createVisualisation({ title: "T", type: "chart" }))).toBe(true);
  });
  it("JSON export is editable: re-reading it gives back the same document", async () => {
    const m = createExportManager(createEntitlementService());
    const doc = make(SAMPLES.flowchart, "flowchart");
    const { blob, filename } = await m.export("vizora-json", doc);
    expect(filename).toMatch(/\.vizora\.json$/);
    const { parseVisualisation } = await import("@/lib/visualisation/migrations");
    expect(parseVisualisation(JSON.parse(await blob.text()))).toEqual(doc);
  });
});
