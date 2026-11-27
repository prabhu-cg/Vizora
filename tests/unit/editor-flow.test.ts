import { describe, expect, it } from "vitest";
import { AXIS_ID, toFlow } from "@/features/editor/flow-adapter";
import { EMPTY_SELECTION, liveSelection } from "@/features/editor/context";
import { SHORTCUTS, matchShortcut, shouldHandle, type KeyLike } from "@/features/editor/shortcuts";
import { documentFromInterpretation, interpret, toggleCollapse, type EngineType } from "@/lib/engine";
import type { VisualisationIR } from "@/types/visualisation";

const make = (text: string, type: EngineType): VisualisationIR => documentFromInterpretation(text, interpret(text, { type }));
const FLOW = "1. A\n2. If ok, B, otherwise C\n3. D";
const MIND = "Create a mind map for Root\n- One\n  - One A\n  - One B\n- Two";

describe("toFlow (IR → React Flow projection)", () => {
  it("projects every node and edge with handles chosen from geometry", () => {
    const d = make(FLOW, "flowchart");
    const f = toFlow(d, EMPTY_SELECTION);
    expect(f.nodes).toHaveLength(d.nodes.length);
    expect(f.edges).toHaveLength(d.edges.length);
    expect(f.nodes.every((n) => n.width && n.height)).toBe(true);
    for (const e of f.edges) expect(["top", "right", "bottom", "left"]).toContain(e.sourceHandle);
    // top-to-bottom flow leaves from the bottom and enters at the top
    expect(f.edges[0]).toMatchObject({ sourceHandle: "bottom", targetHandle: "top" });
  });
  it("flowcharts and concept maps are draggable and connectable; mind maps and timelines are not", () => {
    expect(toFlow(make(FLOW, "flowchart"), EMPTY_SELECTION).nodes[0]).toMatchObject({ draggable: true, connectable: true });
    expect(toFlow(make(MIND, "mindmap"), EMPTY_SELECTION).nodes[0]).toMatchObject({ draggable: false, connectable: false });
    expect(toFlow(make("2026-01-01: A\n2026-02-01: B", "timeline"), EMPTY_SELECTION).nodes.find((n) => n.id !== AXIS_ID)).toMatchObject({ draggable: false });
  });
  it("directed edges get arrowheads; mind-map links do not; labels carry through", () => {
    const flow = toFlow(make(FLOW, "flowchart"), EMPTY_SELECTION);
    expect(flow.edges.every((e) => e.markerEnd)).toBe(true);
    expect(flow.edges.some((e) => e.label === "Yes")).toBe(true);
    expect(toFlow(make(MIND, "mindmap"), EMPTY_SELECTION).edges.some((e) => e.markerEnd)).toBe(false);
  });
  it("applies selection and drag overrides without touching the document", () => {
    const d = make(FLOW, "flowchart");
    const id = d.nodes[1]!.id;
    const f = toFlow(d, { nodes: [id], edges: [d.edges[0]!.id] }, { [id]: { x: 5, y: 6 } });
    expect(f.nodes.find((n) => n.id === id)).toMatchObject({ selected: true, position: { x: 5, y: 6 } });
    expect(f.edges[0]!.selected).toBe(true);
    expect(d.nodes[1]!.position).not.toEqual({ x: 5, y: 6 });
  });
  it("collapsed mind-map branches and their edges are not projected; the chevron data is", () => {
    let d = make(MIND, "mindmap");
    const one = d.nodes.find((n) => n.label === "One")!.id;
    expect(toFlow(d, EMPTY_SELECTION).nodes.find((n) => n.id === one)!.data).toMatchObject({ childCount: 2, outward: expect.stringMatching(/left|right/) });
    d = toggleCollapse(d, one);
    const f = toFlow(d, EMPTY_SELECTION);
    expect(f.nodes.map((n) => (n.data as { node: { label: string } }).node.label)).not.toContain("One A");
    expect(f.edges).toHaveLength(d.edges.length - 2);
  });
  it("timelines add a non-interactive axis and record which side each card is on", () => {
    const f = toFlow(make("2026-01-01: A\n2026-02-01: B\n2026-03-01: C", "timeline"), EMPTY_SELECTION);
    const axis = f.nodes.find((n) => n.id === AXIS_ID)!;
    expect(axis).toMatchObject({ selectable: false, draggable: false, zIndex: -1 });
    expect(f.nodes.filter((n) => n.id !== AXIS_ID).map((n) => (n.data as { side: string }).side)).toEqual(["before", "after", "before"]);
    expect(f.edges).toEqual([]);
  });
  it("gives screen readers a meaningful name for items and connections", () => {
    const f = toFlow(make(FLOW, "flowchart"), EMPTY_SELECTION);
    expect(f.nodes[0]!.ariaLabel).toMatch(/^start: Start$/);
    expect(f.edges.find((e) => e.label === "Yes")!.ariaLabel).toMatch(/^Yes: .+ to .+$/);
  });
  it("liveSelection drops ids that no longer exist", () => {
    const d = make(FLOW, "flowchart");
    const s = { nodes: [d.nodes[0]!.id, "gone"], edges: ["gone-edge"] };
    expect(liveSelection(d, s)).toEqual({ nodes: [d.nodes[0]!.id], edges: [] });
    const ok = { nodes: [d.nodes[0]!.id], edges: [] };
    expect(liveSelection(d, ok)).toBe(ok);
  });
});

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });

describe("keyboard shortcuts", () => {
  it("maps the documented keys", () => {
    expect(matchShortcut(key("z", { ctrlKey: true }))).toBe("undo");
    expect(matchShortcut(key("z", { metaKey: true }))).toBe("undo");
    expect(matchShortcut(key("Z", { ctrlKey: true, shiftKey: true }))).toBe("redo");
    expect(matchShortcut(key("y", { ctrlKey: true }))).toBe("redo");
    expect(matchShortcut(key("d", { metaKey: true }))).toBe("duplicate");
    expect(matchShortcut(key("0", { ctrlKey: true }))).toBe("fit");
    expect(matchShortcut(key("Delete"))).toBe("delete");
    expect(matchShortcut(key("Backspace"))).toBe("delete");
    expect(matchShortcut(key("Enter"))).toBe("edit");
    expect(matchShortcut(key("F2"))).toBe("edit");
    expect(matchShortcut(key("Tab"))).toBe("add-child");
    expect(matchShortcut(key("Enter", { altKey: true }))).toBe("add-sibling");
    expect(matchShortcut(key("Escape"))).toBe("deselect");
    expect(matchShortcut(key("+"))).toBe("zoom-in");
    expect(matchShortcut(key("-"))).toBe("zoom-out");
    expect(matchShortcut(key("?", { shiftKey: true }))).toBe("help");
    expect(matchShortcut(key("["))).toBe("toggle-left");
    expect(matchShortcut(key("]"))).toBe("toggle-right");
    expect(matchShortcut(key("f"))).toBe("focus");
    expect(matchShortcut(key("f", { ctrlKey: true }))).toBeUndefined(); // never steals browser find
  });
  it("leaves unrelated and browser-reserved combinations alone", () => {
    expect(matchShortcut(key("Tab", { shiftKey: true }))).toBeUndefined(); // reverse focus travel
    expect(matchShortcut(key("c", { ctrlKey: true }))).toBeUndefined();
    expect(matchShortcut(key("r", { metaKey: true }))).toBeUndefined();
    expect(matchShortcut(key("x"))).toBeUndefined();
  });
  it("every documented shortcut action is reachable", () => {
    const reachable = new Set(
      [key("z", { ctrlKey: true }), key("Z", { ctrlKey: true, shiftKey: true }), key("d", { ctrlKey: true }), key("Delete"), key("Enter"), key("Tab"), key("Enter", { altKey: true }),
        key("a", { ctrlKey: true }), key("0", { ctrlKey: true }), key("+"), key("-"), key("Escape"), key("?"), key("["), key("]"), key("f")].map(matchShortcut),
    );
    for (const s of SHORTCUTS) expect(reachable.has(s.action), s.action).toBe(true);
  });
  describe("when they apply", () => {
    const host = (html: string) => {
      document.body.innerHTML = html;
      return document;
    };
    it("never while typing in a field", () => {
      const d = host('<div data-editor-canvas><textarea id="t"></textarea></div>');
      expect(shouldHandle("delete", d.getElementById("t"), d)).toBe(false);
      expect(shouldHandle("undo", d.getElementById("t"), d)).toBe(false);
    });
    it("never while a dialog is open", () => {
      const d = host('<div role="alertdialog"></div><div data-editor-canvas><button id="b"></button></div>');
      expect(shouldHandle("delete", d.getElementById("b"), d)).toBe(false);
    });
    it("panel and full-screen toggles work from anywhere except text fields and dialogs", () => {
      const d = host('<button id="outside">x</button><input id="field"/>');
      expect(shouldHandle("toggle-left", d.getElementById("outside"), d)).toBe(true);
      expect(shouldHandle("focus", d.body, d)).toBe(true);
      expect(shouldHandle("focus", d.getElementById("field"), d)).toBe(false);
    });
    it("in the canvas yes; Tab elsewhere on the page must keep moving focus", () => {
      const d = host('<button id="outside">x</button><div data-editor-canvas><div class="react-flow__node" id="n" tabindex="0"></div></div>');
      expect(shouldHandle("add-child", d.getElementById("n"), d)).toBe(true);
      expect(shouldHandle("add-child", d.getElementById("outside"), d)).toBe(false);
      expect(shouldHandle("add-child", d.body, d)).toBe(false);
      expect(shouldHandle("delete", d.body, d)).toBe(true);
    });
  });
});
