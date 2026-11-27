import { describe, expect, it, vi } from "vitest";
import { buildDataset, readText } from "@/lib/data";
import { documentFromInterpretation, interpret } from "@/lib/engine";
import { copyEmbedCode, createExportManager, embedExporter, embedSnippet, embeddableSvg } from "@/lib/export";
import { createEntitlementService } from "@/features/entitlements";
import { createVisualisation } from "@/lib/visualisation/factory";

const flow = (title = "Sign-up <flow> & \"checks\"") => ({ ...documentFromInterpretation("1. Sign up\n2. If verified, activate, otherwise resend", interpret("1. Sign up\n2. If verified, activate, otherwise resend", { type: "flowchart" })), title });
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("embeddableSvg", () => {
  const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><defs><marker id="a"><path d="M0 0"/></marker></defs><path marker-end="url(#a)" d="M0 0"/></svg>';
  it("is fluid, keeps its aspect ratio, and drops the XML declaration", () => {
    const out = embeddableSvg(svg, 400, "u1");
    expect(out.startsWith("<svg")).toBe(true);
    expect(out).toContain('viewBox="0 0 400 200"');
    expect(out).toMatch(/style="display:block;width:100%;max-width:400px;height:auto"/);
    expect(out).not.toMatch(/\swidth="400"/);
  });
  it("makes internal ids unique so two embeds on one page cannot clash", () => {
    const a = embeddableSvg(svg, 400, "u1");
    const b = embeddableSvg(svg, 400, "u2");
    expect(a).toContain('id="u1-a"');
    expect(a).toContain("url(#u1-a)");
    expect(a).not.toContain('id="a"');
    expect(b).toContain("url(#u2-a)");
  });
});

describe("embed snippet", () => {
  it("is a figure with the picture inline, a caption, and nothing that loads from elsewhere", async () => {
    const html = await embedSnippet(flow());
    const doc = parse(html);
    expect(doc.querySelector("figure svg")).not.toBeNull();
    expect(doc.querySelectorAll("[data-node]").length).toBeGreaterThan(1);
    expect(html).not.toMatch(/<script|<iframe|https?:\/\/(?!www\.w3\.org)/i);
    expect(html).not.toMatch(/\son\w+=/i); // no event-handler attributes
    expect(html).toMatch(/does not update/);
  });
  it("escapes the title in the caption and comment, so a title cannot inject markup", async () => {
    const html = await embedSnippet(flow());
    expect(html).toContain("Sign-up &lt;flow&gt; &amp; &quot;checks&quot;");
    expect(html).not.toContain("<flow>");
    expect(parse(html).querySelector("figcaption")!.textContent).toBe('Sign-up <flow> & "checks"');
  });
  it("two embeds of different visualisations use different ids", async () => {
    const a = await embedSnippet(flow());
    const other = { ...flow("Other"), id: "other-id" };
    const b = await embedSnippet(other);
    const ids = (h: string) => [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const shared = ids(a).filter((i) => ids(b).includes(i));
    expect(shared).toEqual([]);
  });
  it("works for a chart", async () => {
    const base = createVisualisation({ title: "Sales", type: "chart" });
    const { dataset } = buildDataset(readText("Month,Revenue\nJan,10\nFeb,14", { name: "s.csv" }), { name: "s" });
    const html = await embedSnippet({ ...base, data: { datasets: [dataset] } });
    expect(parse(html).querySelector("figure svg")).not.toBeNull();
    expect(html).toContain("Revenue");
  });
});

describe("html embed page exporter", () => {
  it("produces a complete standalone page", async () => {
    const { filename, blob } = await embedExporter.run(flow("My flow"));
    expect(filename).toBe("my-flow-embed.html");
    const text = await blob.text();
    expect(text.startsWith("<!doctype html>")).toBe(true);
    const doc = parse(text);
    expect(doc.title).toBe("My flow");
    expect(doc.querySelector("figure svg")).not.toBeNull();
  });
  it("is offered for drawable visualisations only", () => {
    const m = createExportManager(createEntitlementService());
    expect(m.available(flow()).map((e) => e.id)).toContain("html-embed");
    expect(m.available(createVisualisation({ title: "Empty", type: "chart" })).map((e) => e.id)).not.toContain("html-embed");
    expect(m.available(createVisualisation({ title: "T", type: "table" })).map((e) => e.id)).not.toContain("html-embed");
  });
});

describe("copyEmbedCode", () => {
  it("puts the snippet on the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    expect(await copyEmbedCode(flow())).toBe(true);
    expect(writeText.mock.calls[0]![0]).toContain("<figure");
  });
  it("reports false instead of throwing when the browser refuses", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    expect(await copyEmbedCode(flow())).toBe(false);
  });
});
