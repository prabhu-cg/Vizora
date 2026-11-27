import { describe, expect, it } from "vitest";
import { addNode, canDelete, deleteNodes, documentFromInterpretation, duplicateNodes, getExtras, interpret, mindTree, planConversion, setAllCollapsed, toggleCollapse } from "@/lib/engine";
import { splitPerson } from "@/lib/engine/interpret/orgchart";
import { initials } from "@/lib/engine/people";
import { renderDiagramSvg } from "@/lib/export";
import { parseVisualisation } from "@/lib/visualisation/migrations";
import type { VisualisationIR } from "@/types/visualisation";

const TEXT = "Ada Lovelace - CEO\n  Bo Chen - CTO\n    Cy Diaz - Engineer\n    Eve Ford - Engineer\n  Di Evans (COO)\n  Fay Green, Head of People";
const make = (text = TEXT): VisualisationIR => documentFromInterpretation(text, interpret(text, { type: "orgchart" }));
const by = (d: VisualisationIR, label: string) => d.nodes.find((n) => n.label === label)!;
const rect = (n: VisualisationIR["nodes"][number]) => ({ x: n.position.x, y: n.position.y, w: n.size!.width, h: n.size!.height });
const overlaps = (d: VisualisationIR) => d.nodes.flatMap((a, i) => d.nodes.slice(i + 1).filter((b) => { const p = rect(a), q = rect(b); return p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h; }).map((b) => [a.label, b.label]));

describe("reading people", () => {
  it("splits a name from a role in the usual ways", () => {
    expect(splitPerson("Ada Lovelace - CEO")).toEqual({ name: "Ada Lovelace", role: "CEO" });
    expect(splitPerson("Ada Lovelace – Chief Executive")).toEqual({ name: "Ada Lovelace", role: "Chief Executive" });
    expect(splitPerson("Di Evans (COO)")).toEqual({ name: "Di Evans", role: "COO" });
    expect(splitPerson("Fay Green, Head of People")).toEqual({ name: "Fay Green", role: "Head of People" });
    expect(splitPerson("Just a name")).toEqual({ name: "Just a name" });
  });
  it("a comma only splits when what precedes it is short enough to be a name", () => {
    expect(splitPerson("Marketing and brand strategy for the year ahead, with partners").role).toBeUndefined();
  });
  it("indentation is who reports to whom; the role is kept on the person", () => {
    const d = make();
    expect(d.type).toBe("orgchart");
    const t = mindTree(d);
    expect(d.nodes.find((n) => n.id === t.rootId)!.label).toBe("Ada Lovelace");
    expect(t.children.get(by(d, "Ada Lovelace").id)!.map((id) => t.byId.get(id)!.label)).toEqual(["Bo Chen", "Di Evans", "Fay Green"]);
    expect(t.children.get(by(d, "Bo Chen").id)).toHaveLength(2);
    expect(getExtras(by(d, "Bo Chen")).description).toBe("CTO");
    expect(getExtras(by(d, "Di Evans")).description).toBe("COO");
  });
  it("lays out top to bottom", () => {
    const d = make();
    expect(d.layout.direction).toBe("TB");
    const y = (l: string) => by(d, l).position.y;
    expect(y("Ada Lovelace")).toBeLessThan(y("Bo Chen"));
    expect(y("Bo Chen")).toBeLessThan(y("Cy Diaz"));
    expect(y("Bo Chen")).toBe(y("Di Evans")); // peers share a row
  });
  it("centres each manager above their reports and never overlaps anyone", () => {
    const d = make();
    const mid = (l: string) => by(d, l).position.x + by(d, l).size!.width / 2;
    expect(mid("Bo Chen")).toBeCloseTo((mid("Cy Diaz") + mid("Eve Ford")) / 2, 0);
    expect(overlaps(d)).toEqual([]);
  });
  it("is deterministic", () => {
    expect(make().nodes.map((n) => n.position)).toEqual(make().nodes.map((n) => n.position));
  });
  it("several people with nobody on top get a labelled box above them, with an explanation", () => {
    const text = "Ada - CEO\nBo - CTO";
    const it = interpret(text, { type: "orgchart" });
    const d = documentFromInterpretation(text, it);
    expect(it.warnings.map((w) => w.code)).toContain("no-head");
    expect(d.nodes.find((n) => n.type === "topic")!.label).toBe("Organisation");
    expect(mindTree(d).children.get(mindTree(d).rootId!)).toHaveLength(2);
  });
  it("is chosen by the words 'org chart', never guessed from an outline alone", () => {
    expect(interpret("Create an org chart for the team\nAda - CEO\n  Bo - CTO").detection.type).toBe("orgchart");
    expect(interpret("Ideas\n- One\n  - Two\n- Three").detection.type).not.toBe("orgchart");
  });
  it("a request with no people makes an empty chart and says so", () => {
    const it = interpret("Create an org chart for my company", { type: "orgchart" });
    expect(it.requestOnly).toBe(true);
    expect(it.warnings.map((w) => w.code)).toContain("request-only");
  });
});

describe("editing an org chart", () => {
  it("adds a person under a manager, with a sensible name, and keeps the layout valid", () => {
    const d = make();
    const r = addNode(d, { from: by(d, "Di Evans").id });
    expect(r.doc.nodes.find((n) => n.id === r.id)!.label).toBe("New person");
    expect(mindTree(r.doc).parent.get(r.id)).toBe(by(d, "Di Evans").id);
    expect(overlaps(r.doc)).toEqual([]);
  });
  it("people are not colour-coded like mind-map branches", () => {
    const d = make();
    const r = addNode(d, { from: by(d, "Ada Lovelace").id });
    expect(r.doc.nodes.find((n) => n.id === r.id)!.style).toBeUndefined();
    expect(d.nodes.every((n) => n.style === undefined)).toBe(true);
  });
  it("the head of the organisation cannot be deleted; deleting a manager removes everyone beneath", () => {
    const d = make();
    expect(canDelete(d, [by(d, "Ada Lovelace").id])).toBe(false);
    const gone = deleteNodes(d, [by(d, "Bo Chen").id]);
    expect(gone.nodes.map((n) => n.label).sort()).toEqual(["Ada Lovelace", "Di Evans", "Fay Green"]);
  });
  it("duplicating a manager copies their whole team", () => {
    const d = make();
    const r = duplicateNodes(d, [by(d, "Bo Chen").id]);
    expect(r.doc.nodes.length).toBe(d.nodes.length + 3);
  });
  it("folding a team hides it and lays the rest out again; expand all brings it back", () => {
    const d = make();
    const folded = toggleCollapse(d, by(d, "Bo Chen").id);
    expect(getExtras(by(folded, "Bo Chen")).collapsed).toBe(true);
    const sibling = by(folded, "Di Evans");
    expect(sibling.position.y).toBe(by(folded, "Bo Chen").position.y);
    const open = setAllCollapsed(folded, false);
    expect(getExtras(by(open, "Bo Chen")).collapsed).toBeUndefined();
  });
  it("round-trips through the document schema", () => {
    const back = parseVisualisation(JSON.parse(JSON.stringify(make())));
    expect(back.type).toBe("orgchart");
    expect(getExtras(by(back, "Bo Chen")).description).toBe("CTO");
  });
});

describe("converting to and from an org chart", () => {
  it("a mind map becomes an org chart with colours cleared, and back again", () => {
    const text = "Launch\n- Marketing\n  - Website\n- Product";
    const mind = documentFromInterpretation(text, interpret(text, { type: "mindmap" }));
    expect(mind.nodes.some((n) => n.style?.color)).toBe(true);
    const org = planConversion(mind, "orgchart").result!;
    expect(org.type).toBe("orgchart");
    expect(org.nodes.every((n) => !n.style?.color)).toBe(true);
    expect(org.nodes.map((n) => n.label).sort()).toEqual(mind.nodes.map((n) => n.label).sort());
    const back = planConversion(org, "mindmap").result!;
    expect(back.type).toBe("mindmap");
  });
  it("an org chart becomes a flowchart or concept map with its connections", () => {
    const d = make();
    for (const to of ["flowchart", "conceptmap"] as const) {
      const r = planConversion(d, to).result!;
      expect(r.type).toBe(to);
      expect(r.edges.length).toBe(d.edges.length);
    }
  });
  it("the plan says 'head of the organisation', not 'central topic'", () => {
    const flow = documentFromInterpretation("1. A\n2. B\n3. C", interpret("1. A\n2. B\n3. C", { type: "flowchart" }));
    const plan = planConversion(flow, "orgchart");
    expect(plan.changes.map((c) => c.text).join(" ")).not.toMatch(/central topic/);
  });
});

describe("exporting an org chart", () => {
  it("draws every person with initials, role and reporting lines, and is well-formed", () => {
    const { svg } = renderDiagramSvg(make());
    const xml = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(xml.querySelector("parsererror")).toBeNull();
    expect(xml.querySelectorAll("[data-node]")).toHaveLength(6);
    expect(xml.querySelectorAll("[data-edge]")).toHaveLength(5);
    for (const t of ["Ada Lovelace", "CEO", "CTO", "AL", "BC"]) expect(svg).toContain(t);
    expect(svg).not.toContain("polygon"); // no arrowheads: reporting lines are plain
  });
  it("a folded team shows how many people it hides", () => {
    const folded = toggleCollapse(make(), by(make(), "Bo Chen").id);
    const d = make();
    const f = toggleCollapse(d, by(d, "Bo Chen").id);
    void folded;
    expect(renderDiagramSvg(f).svg).toContain("+2");
  });
  it("names are escaped, so a name cannot inject markup", () => {
    const d = make("<script>x</script> & Co - \"CEO\"\n  Bo - CTO");
    const { svg } = renderDiagramSvg(d);
    expect(svg).not.toContain("<script>");
    expect(new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("parsererror")).toBeNull();
  });
});

describe("avatar initials", () => {
  it("takes the first and last word's first letter", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("Mary Jane Watson")).toBe("MW");
    expect(initials("Platform")).toBe("P");
    expect(initials("  ")).toBe("?");
    expect(initials("élan vital")).toBe("ÉV");
  });
});
