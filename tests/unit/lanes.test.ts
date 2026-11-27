import { describe, expect, it } from "vitest";
import {
  addLane, addNode, assignLane, documentFromInterpretation, getExtras, interpret, laneGeometry, moveLane, moveNodes, readLanes, removeLane, renameLane, setLanes, withLanePositions, deleteNodes,
} from "@/lib/engine";
import { renderDiagramSvg } from "@/lib/export";
import { parseVisualisation } from "@/lib/visualisation/migrations";
import type { VisualisationIR } from "@/types/visualisation";

const TEXT = "1. Place order [Customer]\n2. Check stock [Warehouse]\n3. Pack the items [Warehouse]\n4. Receive parcel [Customer]";
const make = (text = TEXT): VisualisationIR => documentFromInterpretation(text, interpret(text, { type: "flowchart" }));
const laneOf = (d: VisualisationIR, label: string) => getExtras(d.nodes.find((n) => n.label === label)!).lane;
const byLabel = (d: VisualisationIR, label: string) => d.nodes.find((n) => n.label === label)!;

describe("reading [Lane] tags", () => {
  it("makes lanes in order of first appearance and puts each step in its lane", () => {
    const d = make();
    expect(readLanes(d)).toEqual(["Customer", "Warehouse"]);
    expect(laneOf(d, "Place order")).toBe("Customer");
    expect(laneOf(d, "Pack the items")).toBe("Warehouse");
    expect(d.layout.direction).toBe("LR"); // swimlanes read left to right
  });
  it("strips the tag from the step's text", () => {
    expect(make().nodes.map((n) => n.label).join("|")).not.toMatch(/\[|\]/);
  });
  it("Start and End join the lane of the step beside them", () => {
    const d = make();
    const start = d.nodes.find((n) => n.type === "start")!, end = d.nodes.find((n) => n.type === "end")!;
    expect(getExtras(start).lane).toBe("Customer"); // beside "Place order"
    expect(getExtras(end).lane).toBe("Customer"); // beside "Receive parcel", the last step
  });
  it("one lane alone is ignored, with an explanation", () => {
    const text = "1. A [Only]\n2. B [Only]";
    const it = interpret(text, { type: "flowchart" });
    const d = documentFromInterpretation(text, it);
    expect(readLanes(d)).toEqual([]);
    expect(it.warnings.map((w) => w.code)).toContain("one-lane");
  });
  it("without tags nothing changes: no lanes, top to bottom", () => {
    const d = make("1. A\n2. B\n3. C");
    expect(readLanes(d)).toEqual([]);
    expect(d.layout.direction).toBe("TB");
  });
  it("lanes come from the text: regenerating without tags removes them", () => {
    const d = make();
    const plain = "1. Place order\n2. Pack";
    const again = documentFromInterpretation(plain, interpret(plain, { type: "flowchart" }), d);
    expect(readLanes(again)).toEqual([]);
  });
  it("a tag on a decision's line places the decision and its outcomes in that lane", () => {
    const text = "1. Receive request [Support]\n2. If it is urgent, escalate it, otherwise reply to it [Manager]";
    const d = documentFromInterpretation(text, interpret(text, { type: "flowchart" }));
    expect(readLanes(d)).toEqual(["Support", "Manager"]);
    const inManager = d.nodes.filter((n) => getExtras(n).lane === "Manager").map((n) => n.type);
    expect(inManager).toEqual(expect.arrayContaining(["decision", "process"]));
    expect(d.nodes.find((n) => n.label === "Receive request")).toBeDefined();
    expect(laneOf(d, "Receive request")).toBe("Support");
  });
});

describe("lane geometry", () => {
  it("stacks the bands without gaps or overlap, and each step sits inside its own band", () => {
    const d = make();
    const geo = laneGeometry(d)!;
    expect(geo.horizontal).toBe(true);
    expect(geo.bands.map((b) => b.name)).toEqual(["Customer", "Warehouse"]);
    geo.bands.forEach((b, i) => {
      if (i > 0) expect(b.start).toBe(geo.bands[i - 1]!.start + geo.bands[i - 1]!.size);
    });
    for (const n of d.nodes) {
      const band = geo.bands[readLanes(d).indexOf(getExtras(n).lane!)]!;
      const y = geo.positions.get(n.id)!.y, h = n.size!.height;
      expect(y).toBeGreaterThanOrEqual(band.start);
      expect(y + h).toBeLessThanOrEqual(band.start + band.size);
    }
  });
  it("keeps each step's place along the flow", () => {
    const d = make();
    const geo = laneGeometry(d)!;
    for (const n of d.nodes) expect(geo.positions.get(n.id)!.x).toBe(n.position.x);
  });
  it("two steps in one lane at the same point along the flow get separate slots, and the band grows", () => {
    let d = setLanes(make("1. A [X]\n2. B [Y]"), ["X", "Y"]);
    const a = byLabel(d, "A"), b = byLabel(d, "B");
    d = { ...d, nodes: d.nodes.map((n) => (n.id === b.id ? { ...n, position: { ...n.position, x: a.position.x } } : n)) };
    const before = laneGeometry(d)!.bands[0]!.size;
    d = assignLane(d, [b.id], "X");
    const geo = laneGeometry(d)!;
    const ya = geo.positions.get(a.id)!.y, yb = geo.positions.get(byLabel(d, "B").id)!.y;
    expect(Math.abs(ya - yb)).toBeGreaterThanOrEqual(44); // not on top of each other
    expect(geo.bands[0]!.size).toBeGreaterThan(before);
  });
  it("vertical flow turns lanes into columns", () => {
    const d = { ...make(), layout: { ...make().layout, direction: "TB" as const } };
    const geo = laneGeometry(d)!;
    expect(geo.horizontal).toBe(false);
    const col = geo.bands[1]!;
    const node = d.nodes.find((n) => getExtras(n).lane === "Warehouse")!;
    const x = geo.positions.get(node.id)!.x;
    expect(x).toBeGreaterThanOrEqual(col.start);
    expect(x + node.size!.width).toBeLessThanOrEqual(col.start + col.size);
  });
  it("is the same document when there are no lanes", () => {
    const d = make("1. A\n2. B");
    expect(laneGeometry(d)).toBeUndefined();
    expect(withLanePositions(d)).toBe(d);
  });
  it("is deterministic", () => {
    expect([...laneGeometry(make())!.positions]).toEqual([...laneGeometry(make())!.positions]);
  });
});

describe("editing lanes", () => {
  it("turning lanes on puts every step in the first lane, flows left to right, and is reversible", () => {
    const plain = make("1. A\n2. B\n3. C");
    const on = setLanes(plain, ["Customer", "Support"]);
    expect(readLanes(on)).toEqual(["Customer", "Support"]);
    expect(on.nodes.every((n) => getExtras(n).lane === "Customer")).toBe(true);
    expect(on.layout.direction).toBe("LR");
    const off = setLanes(on, []);
    expect(readLanes(off)).toEqual([]);
    expect(off.nodes.every((n) => getExtras(n).lane === undefined)).toBe(true);
  });
  it("ignores blanks and duplicates (any case) and caps the number of lanes", () => {
    const d = setLanes(make("1. A\n2. B"), ["  A ", "a", "", "B"]);
    expect(readLanes(d)).toEqual(["A", "B"]);
    const many = setLanes(make("1. A\n2. B"), Array.from({ length: 30 }, (_, i) => `L${i}`));
    expect(readLanes(many)).toHaveLength(12);
  });
  it("adds, renames (steps follow), reorders and removes lanes", () => {
    let d = make();
    d = addLane(d, "Courier");
    expect(readLanes(d)).toEqual(["Customer", "Warehouse", "Courier"]);
    expect(addLane(d, "courier")).toBe(d);
    d = renameLane(d, "Warehouse", "Stock room");
    expect(laneOf(d, "Pack the items")).toBe("Stock room");
    expect(renameLane(d, "Stock room", "Customer")).toBe(d); // would clash
    d = moveLane(d, "Courier", -1);
    expect(readLanes(d)).toEqual(["Customer", "Courier", "Stock room"]);
    expect(moveLane(d, "Customer", -1)).toBe(d);
    d = removeLane(d, "Stock room");
    expect(readLanes(d)).toEqual(["Customer", "Courier"]);
    expect(laneOf(d, "Pack the items")).toBe("Courier"); // moved to the lane above
  });
  it("removing the last lane turns swimlanes off", () => {
    let d = setLanes(make("1. A\n2. B"), ["Only"]);
    d = removeLane(d, "Only");
    expect(readLanes(d)).toEqual([]);
  });
  it("assigning to an unknown lane does nothing", () => {
    const d = make();
    expect(assignLane(d, [d.nodes[0]!.id], "Nope")).toBe(d);
  });
});

describe("dragging steps between lanes", () => {
  it("dropping a step in another lane's band moves it to that lane", () => {
    const d = make();
    const geo = laneGeometry(d)!;
    const step = byLabel(d, "Place order");
    const target = geo.bands[1]!;
    const moved = moveNodes(d, { [step.id]: { x: step.position.x, y: target.start + target.size / 2 - step.size!.height / 2 } });
    expect(laneOf(moved, "Place order")).toBe("Warehouse");
  });
  it("dropping inside its own lane keeps the lane, and above or below everything clamps to the nearest lane", () => {
    const d = make();
    const step = byLabel(d, "Check stock");
    expect(laneOf(moveNodes(d, { [step.id]: { x: step.position.x + 50, y: laneGeometry(d)!.positions.get(step.id)!.y } }), "Check stock")).toBe("Warehouse");
    expect(laneOf(moveNodes(d, { [step.id]: { x: step.position.x, y: -5000 } }), "Check stock")).toBe("Customer");
    expect(laneOf(moveNodes(d, { [step.id]: { x: step.position.x, y: 99999 } }), "Check stock")).toBe("Warehouse");
  });
  it("a new step joins the lane of the step it follows, or where it was dropped", () => {
    const d = make();
    const anchor = byLabel(d, "Check stock");
    const after = addNode(d, { kind: "process", from: anchor.id, label: "Extra" });
    expect(laneOf(after.doc, "Extra")).toBe("Warehouse");
    const geo = laneGeometry(d)!;
    const dropped = addNode(d, { kind: "process", label: "Dropped", position: { x: 40, y: geo.bands[0]!.start + 10 } });
    expect(laneOf(dropped.doc, "Dropped")).toBe("Customer");
    const free = addNode(d, { kind: "process", label: "Free" });
    expect(laneOf(free.doc, "Free")).toBe("Customer");
  });
  it("deleting steps leaves a valid lane layout", () => {
    const d = make();
    const gone = deleteNodes(d, [byLabel(d, "Pack the items").id]);
    expect(laneGeometry(gone)!.positions.size).toBe(gone.nodes.length);
  });
});

describe("lanes survive saving and exporting", () => {
  it("round-trips through the document schema", () => {
    const d = make();
    const back = parseVisualisation(JSON.parse(JSON.stringify(d)));
    expect(readLanes(back)).toEqual(["Customer", "Warehouse"]);
    expect(laneOf(back, "Check stock")).toBe("Warehouse");
  });
  it("the SVG draws every lane band with its name, beneath the steps, and is well-formed", () => {
    const { svg, width, height } = renderDiagramSvg(make());
    const xml = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(xml.querySelector("parsererror")).toBeNull();
    expect([...xml.querySelectorAll("[data-lane]")].map((g) => g.getAttribute("data-lane"))).toEqual(["Customer", "Warehouse"]);
    expect(svg.indexOf("data-lane")).toBeLessThan(svg.indexOf("data-node"));
    for (const t of ["Customer", "Warehouse", "Place order", "Pack the items"]) expect(svg).toContain(t);
    expect(width).toBeGreaterThan(300);
    expect(height).toBeGreaterThan(200);
  });
  it("a lane name cannot inject markup into the export", () => {
    const d = renameLane(make(), "Customer", '<script>x</script> & "q"');
    const { svg } = renderDiagramSvg(d);
    expect(svg).not.toContain("<script>");
    expect(new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("parsererror")).toBeNull();
  });
  it("a flowchart without lanes exports exactly as before (no bands)", () => {
    const { svg } = renderDiagramSvg(make("1. A\n2. B"));
    expect(svg).not.toContain("data-lane");
  });
});
