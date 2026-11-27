import { describe, expect, it } from "vitest";
import {
  addNode, applyLayout, canDelete, canMoveEvent, connect, deleteEdges, deleteNodes, documentFromInterpretation, duplicateNodes, getColor, getExtras,
  hiddenNodeIds, interpret, mindTree, moveEvent, moveNodes, moveSibling, planConversion, reparent, reparentTargets, resetLayout, reverseEdge, setLayout,
  setStyle, toggleCollapse, updateEdge, updateNode, type EngineType,
} from "@/lib/engine";
import { visualisationSchema } from "@/lib/validation";
import { History } from "@/features/visualisation/history";
import type { VisualisationIR } from "@/types/visualisation";
import { createVisualisation } from "@/lib/visualisation/factory";

const make = (text: string, type: EngineType): VisualisationIR => documentFromInterpretation(text, interpret(text, { type }));
const FLOW = "1. Sign up\n2. If verified, activate, otherwise resend\n3. Welcome";
const MIND = "Create a mind map for Launch\n- Marketing\n  - Website\n  - Email\n- Product\n  - Pricing\n- Sales";
const CONCEPT = "Customers sign contracts\nSuppliers supply products\nContracts depend on suppliers";
const TIME = "2026-01-01: Kick-off\n2026-02-01: Build\n2026-03-01: Launch";
const id = (d: VisualisationIR, label: string) => d.nodes.find((n) => n.label === label)!.id;
const valid = (d: VisualisationIR) => expect(visualisationSchema.safeParse(d).success).toBe(true);

function overlaps(d: VisualisationIR): string[] {
  const out: string[] = [];
  const r = d.nodes.map((n) => ({ n, x1: n.position.x, y1: n.position.y, x2: n.position.x + (n.size?.width ?? 0), y2: n.position.y + (n.size?.height ?? 0) }));
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i]!, b = r[j]!;
    if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) out.push(`${a.n.label} × ${b.n.label}`);
  }
  return out;
}

describe("layout", () => {
  it.each([
    ["flowchart", FLOW], ["mindmap", MIND], ["conceptmap", CONCEPT], ["timeline", TIME],
  ] as const)("%s: no two nodes overlap and every node has a size", (type, text) => {
    const d = make(text, type);
    expect(overlaps(d)).toEqual([]);
    expect(d.nodes.every((n) => n.size)).toBe(true);
  });
  it("flowchart flows downward (top-to-bottom) along forward edges", () => {
    const d = make(FLOW, "flowchart");
    const y = (label: string) => d.nodes.find((n) => n.label === label)!.position.y;
    expect(y("Start")).toBeLessThan(y("Sign up"));
    expect(y("Sign up")).toBeLessThan(y("Verified?") ?? Infinity);
  });
  it("flowchart direction can switch to left-to-right", () => {
    const d = setLayout(make(FLOW, "flowchart"), { direction: "LR" });
    const x = (label: string) => d.nodes.find((n) => n.label === label)!.position.x;
    expect(x("Start")).toBeLessThan(x("Sign up"));
    expect(overlaps(d)).toEqual([]);
  });
  it("mind map puts branches on both sides of the central topic", () => {
    const d = make(MIND, "mindmap");
    const root = d.nodes.find((n) => n.type === "topic")!;
    const xs = d.nodes.filter((n) => n !== root).map((n) => n.position.x - root.position.x);
    expect(xs.some((x) => x > 0)).toBe(true);
    expect(xs.some((x) => x < 0)).toBe(true);
  });
  it("timeline places events in order, alternating sides, and supports vertical", () => {
    const h = make(TIME, "timeline");
    const xs = h.nodes.map((n) => n.position.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(h.nodes[0]!.position.y).toBeLessThan(0);
    expect(h.nodes[1]!.position.y).toBeGreaterThan(0);
    const v = setLayout(h, { direction: "TB" });
    const ys = v.nodes.map((n) => n.position.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(overlaps(v)).toEqual([]);
  });
  it("force layout for concept maps is deterministic", () => {
    const a = setLayout(make(CONCEPT, "conceptmap"), { algorithm: "force" });
    const b = setLayout(make(CONCEPT, "conceptmap"), { algorithm: "force" });
    expect(a.nodes.map((n) => n.position)).toEqual(b.nodes.map((n) => n.position));
    expect(overlaps(a)).toEqual([]);
  });
  it("resetLayout discards manual positions", () => {
    const d = make(FLOW, "flowchart");
    const moved = moveNodes(d, { [id(d, "Sign up")]: { x: 999, y: 999 } });
    expect(moved.nodes.find((n) => n.label === "Sign up")!.position).toEqual({ x: 999, y: 999 });
    expect(resetLayout(moved).nodes.find((n) => n.label === "Sign up")!.position).toEqual(d.nodes.find((n) => n.label === "Sign up")!.position);
  });
});

describe("flowchart editing", () => {
  const d = make(FLOW, "flowchart");
  it("adds a connected step after the selected node", () => {
    const { doc, id: nid } = addNode(d, { from: id(d, "Sign up"), label: "Check fraud" });
    expect(doc.nodes.find((n) => n.id === nid)!.type).toBe("process");
    expect(doc.edges.some((e) => e.source === id(d, "Sign up") && e.target === nid)).toBe(true);
    valid(doc);
  });
  it("does not connect new steps out of an End node", () => {
    const end = d.nodes.find((n) => n.type === "end")!;
    const { doc } = addNode(d, { from: end.id });
    expect(doc.edges).toHaveLength(d.edges.length);
  });
  it("adds decision / input-output / start / end kinds", () => {
    for (const kind of ["decision", "io", "start", "end"]) expect(addNode(d, { kind }).doc.nodes.at(-1)!.type).toBe(kind);
  });
  it("deleting a middle step joins its neighbours", () => {
    const doc = deleteNodes(d, [id(d, "Sign up")]);
    expect(doc.nodes.some((n) => n.label === "Sign up")).toBe(false);
    expect(doc.edges.some((e) => e.source === id(d, "Start") && e.target === id(d, "Verified?"))).toBe(true);
    valid(doc);
  });
  it("connect ignores self-links, duplicates and unknown ids; edges can be edited, reversed and deleted", () => {
    const a = id(d, "Sign up"), b = id(d, "Welcome");
    expect(connect(d, a, a)).toBe(d);
    expect(connect(d, a, "nope")).toBe(d);
    const c = connect(d, a, b, "skip");
    expect(c.edges).toHaveLength(d.edges.length + 1);
    expect(connect(c, a, b)).toBe(c);
    const e = c.edges.at(-1)!;
    expect(updateEdge(c, e.id, { label: "" }).edges.at(-1)!.label).toBeUndefined();
    expect(updateEdge(c, e.id, { directed: false }).edges.at(-1)!.data).toEqual({ directed: false });
    const r = reverseEdge(c, e.id).edges.at(-1)!;
    expect([r.source, r.target]).toEqual([b, a]);
    expect(deleteEdges(c, [e.id]).edges).toHaveLength(d.edges.length);
  });
  it("edits labels (re-measuring), kinds, descriptions and colours; ignores blank labels", () => {
    const n = id(d, "Sign up");
    const long = updateNode(d, n, { label: "Sign up with an extraordinarily long and wordy label that must wrap" });
    expect(long.nodes.find((x) => x.id === n)!.size!.height).toBeGreaterThan(d.nodes.find((x) => x.id === n)!.size!.height);
    expect(updateNode(d, n, { label: "   " })).toBe(d);
    expect(updateNode(d, n, { kind: "decision" }).nodes.find((x) => x.id === n)!.type).toBe("decision");
    expect(updateNode(d, n, { kind: "bogus" })).toBe(d);
    const styled = updateNode(updateNode(d, n, { description: "Why" }), n, { color: "green" });
    expect(getExtras(styled.nodes.find((x) => x.id === n)!).description).toBe("Why");
    expect(getColor(styled.nodes.find((x) => x.id === n)!)).toBe("green");
    expect(getColor(setStyle(d, [n], "red").nodes.find((x) => x.id === n)!)).toBe("red");
    valid(styled);
  });
  it("duplicates nodes with the edges between them, offset and with new ids", () => {
    const ids = [id(d, "Sign up"), id(d, "Verified?")];
    const r = duplicateNodes(d, ids);
    expect(r.ids).toHaveLength(2);
    expect(r.doc.nodes).toHaveLength(d.nodes.length + 2);
    expect(r.doc.edges).toHaveLength(d.edges.length + 1);
    expect(new Set(r.doc.nodes.map((n) => n.id)).size).toBe(r.doc.nodes.length);
    valid(r.doc);
  });
  it("positions are only changed through moveNodes and survive other edits", () => {
    const n = id(d, "Sign up");
    const moved = moveNodes(d, { [n]: { x: 500, y: 40 } });
    expect(updateNode(moved, n, { description: "x" }).nodes.find((x) => x.id === n)!.position).toEqual({ x: 500, y: 40 });
  });
});

describe("mind map editing", () => {
  const d = make(MIND, "mindmap");
  it("adds children under the selected branch, inheriting its colour; new top-level branches get a fresh colour", () => {
    const { doc, id: nid } = addNode(d, { from: id(d, "Marketing"), label: "Social" });
    expect(mindTree(doc).parent.get(nid)).toBe(id(d, "Marketing"));
    expect(getColor(doc.nodes.find((n) => n.id === nid)!)).toBe(getColor(d.nodes.find((n) => n.label === "Marketing")!));
    const top = addNode(d, { label: "Support" }).doc;
    const colours = top.nodes.filter((n) => mindTree(top).parent.get(n.id) === mindTree(top).rootId).map(getColor);
    expect(new Set(colours).size).toBe(colours.length);
    valid(doc);
  });
  it("deleting a branch removes its whole subtree; the central topic cannot be deleted", () => {
    const doc = deleteNodes(d, [id(d, "Marketing")]);
    for (const l of ["Marketing", "Website", "Email"]) expect(doc.nodes.some((n) => n.label === l)).toBe(false);
    expect(doc.edges.every((e) => doc.nodes.some((n) => n.id === e.source) && doc.nodes.some((n) => n.id === e.target))).toBe(true);
    const root = d.nodes.find((n) => n.type === "topic")!.id;
    expect(canDelete(d, [root])).toBe(false);
    expect(deleteNodes(d, [root])).toBe(d);
  });
  it("collapse hides descendants and un-hides when expanded; adding a child expands", () => {
    const m = id(d, "Marketing");
    const c = toggleCollapse(d, m);
    expect([...hiddenNodeIds(c)].sort()).toEqual([id(d, "Website"), id(d, "Email")].sort());
    expect(hiddenNodeIds(toggleCollapse(c, m)).size).toBe(0);
    expect(hiddenNodeIds(addNode(c, { from: m }).doc).size).toBe(0);
    expect(toggleCollapse(d, id(d, "Sales"))).toBe(d); // leaf: nothing to collapse
  });
  it("reparent moves a subtree, never creates cycles, and recolours", () => {
    const moved = reparent(d, id(d, "Pricing"), id(d, "Marketing"));
    expect(mindTree(moved).parent.get(id(d, "Pricing"))).toBe(id(d, "Marketing"));
    expect(getColor(moved.nodes.find((n) => n.label === "Pricing")!)).toBe(getColor(moved.nodes.find((n) => n.label === "Marketing")!));
    expect(reparent(d, id(d, "Marketing"), id(d, "Website"))).toBe(d); // into own descendant
    expect(reparentTargets(d, id(d, "Marketing")).map((n) => n.label)).not.toContain("Website");
    valid(moved);
  });
  it("reorders siblings", () => {
    const after = moveSibling(d, id(d, "Product"), -1);
    const kids = mindTree(after).children.get(mindTree(after).rootId!)!;
    expect(kids.slice(0, 2)).toEqual([id(d, "Product"), id(d, "Marketing")]);
    expect(moveSibling(d, id(d, "Marketing"), -1)).toBe(d);
  });
  it("duplicates a subtree as the next sibling", () => {
    const r = duplicateNodes(d, [id(d, "Marketing")]);
    expect(r.doc.nodes.filter((n) => n.label === "Website")).toHaveLength(2);
    expect(r.doc.nodes).toHaveLength(d.nodes.length + 3);
    valid(r.doc);
  });
  it("dragging is not an edit for derived layouts", () => {
    expect(moveNodes(d, { [id(d, "Sales")]: { x: 1, y: 1 } })).toBe(d);
  });
  it("renaming re-lays out so nothing overlaps", () => {
    const r = updateNode(d, id(d, "Sales"), { label: "Sales and partnerships across every region we operate in" });
    expect(overlaps(r)).toEqual([]);
  });
});

describe("timeline editing", () => {
  const d = make(TIME, "timeline");
  it("editing a date re-sorts a fully dated timeline", () => {
    const r = updateNode(d, id(d, "Kick-off"), { date: "2026-02-15", dateLabel: "15 Feb 2026" });
    expect(r.nodes.map((n) => n.label)).toEqual(["Build", "Kick-off", "Launch"]);
    expect(overlaps(r)).toEqual([]);
  });
  it("a dated event is inserted at its place by date; an undated one after the selection", () => {
    const dated = addNode(d, { label: "Beta", date: "2026-02-20" }).doc;
    expect(dated.nodes.map((n) => n.label)).toEqual(["Kick-off", "Build", "Beta", "Launch"]);
    const after = addNode(d, { label: "Note", from: id(d, "Kick-off") }).doc;
    expect(after.nodes.map((n) => n.label)).toEqual(["Kick-off", "Note", "Build", "Launch"]);
  });
  it("reordering respects chronology: blocked across different dates, allowed for equal ones or undated", () => {
    expect(canMoveEvent(d, id(d, "Build"), -1)).toMatchObject({ ok: false, reason: expect.stringMatching(/Change the date/) });
    expect(moveEvent(d, id(d, "Build"), -1)).toBe(d);
    const undated = make("First thing\nSecond thing\nThird thing", "timeline");
    expect(canMoveEvent(undated, id(undated, "Second thing"), -1).ok).toBe(true);
    expect(moveEvent(undated, id(undated, "Second thing"), -1).nodes.map((n) => n.label)).toEqual(["Second thing", "First thing", "Third thing"]);
    const same = make("2026-01-01: A\n2026-01-01: B", "timeline");
    expect(moveEvent(same, id(same, "B"), -1).nodes.map((n) => n.label)).toEqual(["B", "A"]);
  });
  it("milestones, descriptions and categories are editable", () => {
    const r = updateNode(updateNode(d, id(d, "Build"), { kind: "milestone" }), id(d, "Build"), { description: "Sprint 1–3", category: "Eng" });
    const n = r.nodes.find((x) => x.label === "Build")!;
    expect(n.type).toBe("milestone");
    expect(getExtras(n)).toMatchObject({ description: "Sprint 1–3", category: "Eng" });
    valid(r);
  });
});

describe("concept map editing", () => {
  const d = make(CONCEPT, "conceptmap");
  it("relationships are editable, directional and reversible", () => {
    const e = d.edges[0]!;
    expect(updateEdge(d, e.id, { label: "agree to" }).edges[0]!.label).toBe("agree to");
    expect(updateEdge(d, e.id, { directed: false }).edges[0]!.data?.directed).toBe(false);
    expect(reverseEdge(d, e.id).edges[0]!.source).toBe(e.target);
  });
  it("hierarchical and network layouts both avoid overlap", () => {
    for (const algorithm of ["layered", "force"] as const) expect(overlaps(setLayout(d, { algorithm }))).toEqual([]);
  });
});

describe("format switching", () => {
  it("flowchart → concept map → flowchart restores shapes exactly", () => {
    const f = make(FLOW, "flowchart");
    const c = planConversion(f, "conceptmap");
    expect(c.result!.type).toBe("conceptmap");
    expect(c.result!.nodes.every((n) => n.type === "concept")).toBe(true);
    expect(c.changes.some((x) => /plain concepts/.test(x.text))).toBe(true);
    const back = planConversion(c.result!, "flowchart").result!;
    expect(back.nodes.map((n) => n.type)).toEqual(f.nodes.map((n) => n.type));
    expect(back.edges.map((e) => [e.source, e.target, e.label])).toEqual(f.edges.map((e) => [e.source, e.target, e.label]));
    expect(c.lossless).toBe(true);
    valid(c.result!);
    valid(back);
  });
  it("graph → mind map warns exactly what is dropped and keeps labels for the way back", () => {
    const f = make(FLOW, "flowchart");
    const p = planConversion(f, "mindmap");
    expect(p.lossless).toBe(false);
    expect(p.result!.type).toBe("mindmap");
    const t = mindTree(p.result!);
    expect(p.result!.nodes).toHaveLength(f.nodes.length);
    expect(t.rootId).toBeTruthy();
    // Yes/No labels are removed from view but remembered.
    expect(p.changes.some((c) => c.severity === "loss" && /label/.test(c.text))).toBe(true);
    const back = planConversion(p.result!, "flowchart").result!;
    expect(back.edges.filter((e) => e.label).map((e) => e.label).sort()).toEqual(f.edges.filter((e) => e.label).map((e) => e.label).sort());
    valid(p.result!);
  });
  it("disconnected groups get a titled central topic, disclosed", () => {
    const c = make("Alpha -> Beta\nGamma -> Delta", "conceptmap");
    const p = planConversion(c, "mindmap");
    expect(p.changes.some((x) => /separate group/.test(x.text))).toBe(true);
    const root = p.result!.nodes.find((n) => n.type === "topic")!;
    expect(root.label).toBe(c.title);
    expect(getExtras(root).structural).toBe(true);
    expect(mindTree(p.result!).children.get(root.id)).toHaveLength(2);
  });
  it("edges that do not fit a tree are listed as losses", () => {
    const c = make("A -> B\nA -> C\nB -> C", "conceptmap");
    const p = planConversion(c, "mindmap");
    expect(p.changes.some((x) => x.severity === "loss" && /do not fit a tree/.test(x.text) && /B/.test(x.text))).toBe(true);
  });
  it("mind map → flowchart keeps the hierarchy as arrows", () => {
    const m = make(MIND, "mindmap");
    const p = planConversion(m, "flowchart");
    expect(p.result!.type).toBe("flowchart");
    expect(p.result!.edges).toHaveLength(m.edges.length);
    expect(p.result!.nodes.every((n) => n.type === "process")).toBe(true);
    expect(p.lossless).toBe(true);
  });
  it("timeline → flowchart creates sequence edges and says they are new; → concept map invents none", () => {
    const t = make(TIME, "timeline");
    const f = planConversion(t, "flowchart");
    expect(f.result!.edges).toHaveLength(2);
    expect(f.changes.some((c) => /new/.test(c.text))).toBe(true);
    expect(f.changes.some((c) => c.severity === "loss" && /Dates/.test(c.text))).toBe(true);
    expect(planConversion(t, "conceptmap").result!.edges).toEqual([]);
    // dates survive in data for the trip back
    const back = planConversion(f.result!, "timeline").result!;
    expect(back.nodes.map((n) => getExtras(n).date)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    expect(back.nodes.map((n) => n.label)).toEqual(["Kick-off", "Build", "Launch"]);
  });
  it("graph → timeline follows flow order when undated and date order when dated; drops edges as a loss", () => {
    const f = make("1. Alpha\n2. Beta\n3. Gamma", "flowchart");
    const p = planConversion(f, "timeline");
    expect(p.result!.nodes.map((n) => n.label)).toEqual(["Start", "Alpha", "Beta", "Gamma", "End"]);
    expect(p.changes.some((c) => c.severity === "loss" && /connection/.test(c.text))).toBe(true);
    expect(p.result!.edges).toEqual([]);
  });
  it("charts cannot be converted, and the reason is given", () => {
    const p = planConversion(createVisualisation({ title: "C", type: "chart" }), "flowchart");
    expect(p.blocked).toMatch(/built from data/);
    expect(p.result).toBeUndefined();
  });
  it("same type is a no-op; empty documents just change type", () => {
    const f = make(FLOW, "flowchart");
    expect(planConversion(f, "flowchart").result).toBe(f);
    const e = planConversion(createVisualisation({ title: "E", type: "flowchart" }), "mindmap");
    expect(e.result!.type).toBe("mindmap");
    valid(e.result!);
  });
  it("preserves identity: id, title, description, timestamps and source", () => {
    const f = make(FLOW, "flowchart");
    const r = planConversion(f, "conceptmap").result!;
    expect([r.id, r.title, r.createdAt, r.source.kind]).toEqual([f.id, f.title, f.createdAt, f.source.kind]);
  });
  it("every pair of engine types converts to a valid, non-overlapping document", () => {
    const docs = { flowchart: make(FLOW, "flowchart"), mindmap: make(MIND, "mindmap"), conceptmap: make(CONCEPT, "conceptmap"), timeline: make(TIME, "timeline") };
    for (const from of Object.keys(docs) as EngineType[]) for (const to of Object.keys(docs) as EngineType[]) {
      const r = planConversion(docs[from], to).result!;
      expect(r.type, `${from}→${to}`).toBe(to);
      valid(r);
      expect(overlaps(r), `${from}→${to}`).toEqual([]);
    }
  });
});

describe("History", () => {
  it("undoes and redoes whole snapshots; new edits clear redo", () => {
    const h = new History<string>();
    h.record("a");
    h.record("b");
    expect(h.undo("c")).toBe("b");
    expect(h.undo("b")).toBe("a");
    expect(h.undo("a")).toBeUndefined();
    expect(h.redo("a")).toBe("b");
    h.record("b");
    expect(h.canRedo).toBe(false);
  });
  it("coalesces rapid edits with the same key, but not across keys or after the window", () => {
    const h = new History<string>(100, 1000);
    h.record("v0", "title", 0);
    h.record("v1", "title", 300);
    h.record("v2", "title", 600);
    expect(h.undo("v3")).toBe("v0");
    expect(h.canUndo).toBe(false);
    const g = new History<string>(100, 1000);
    g.record("a", "k", 0);
    g.record("b", "k", 2000);
    g.record("c", "other", 2100);
    expect(g.undo("d")).toBe("c");
    expect(g.undo("c")).toBe("b");
    expect(g.undo("b")).toBe("a");
  });
  it("caps memory", () => {
    const h = new History<number>(3);
    for (let i = 0; i < 10; i++) h.record(i);
    let n = 0;
    while (h.undo(0) !== undefined) n++;
    expect(n).toBe(3);
  });
});

void applyLayout;
