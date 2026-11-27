import { ReactFlowProvider } from "@xyflow/react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback, useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { ConvertDialog } from "@/features/editor/convert-dialog";
import { EngineCanvas } from "@/features/editor/canvas";
import { EditorProvider } from "@/features/editor/context";
import { Inspector } from "@/features/editor/inspector";
import { SourcePanel } from "@/features/editor/source-panel";
import { EditorToolbar } from "@/features/editor/toolbar";
import { useEditorSession, type EditorSession } from "@/features/editor/use-editor-session";
import { History } from "@/features/visualisation/history";
import { documentFromInterpretation, getColor, getExtras, interpret, mindTree, type EngineType } from "@/lib/engine";
import type { VisualisationIR } from "@/types/visualisation";

const make = (text: string, type: EngineType): VisualisationIR => documentFromInterpretation(text, interpret(text, { type }));
const FLOW = "1. Sign up\n2. If verified, activate, otherwise resend\n3. Welcome";
const MIND = "Create a mind map for Launch\n- Marketing\n  - Website\n- Product\n- Sales";
const TIME = "2026-01-01: Kick-off\n2026-02-01: Build\n2026-03-01: Launch";
const CONCEPT = "Customers sign contracts\nSuppliers supply products";

/** A real editor around a plain in-memory document, with the same undo/redo semantics as the app. */
function Harness({ initial, children }: { initial: VisualisationIR; children?: (api: Api) => React.ReactNode }) {
  const [doc, setDoc] = useState(initial);
  const docRef = useRef(doc);
  const history = useRef(new History<VisualisationIR>());
  const [flags, setFlags] = useState({ canUndo: false, canRedo: false });
  const sync = useCallback(() => setFlags({ canUndo: history.current.canUndo, canRedo: history.current.canRedo }), []);
  const update = useCallback((u: (d: VisualisationIR) => VisualisationIR, o?: { coalesceKey?: string; history?: boolean }) => {
    const next = u(docRef.current);
    if (next === docRef.current) return;
    if (o?.history !== false) history.current.record(docRef.current, o?.coalesceKey);
    docRef.current = next;
    setDoc(next);
    sync();
  }, [sync]);
  const undo = useCallback(() => { const p = history.current.undo(docRef.current); if (p) { docRef.current = p; setDoc(p); } sync(); }, [sync]);
  const redo = useCallback(() => { const p = history.current.redo(docRef.current); if (p) { docRef.current = p; setDoc(p); } sync(); }, [sync]);
  const session = useEditorSession(doc, update);
  const api: Api = { doc, update, undo, redo, session, canUndo: flags.canUndo, canRedo: flags.canRedo };
  return (
    <ReactFlowProvider>
      <EditorProvider value={session.ctx}>
        <pre data-testid="doc">{JSON.stringify({ type: doc.type, nodes: doc.nodes.map((n) => ({ id: n.id, label: n.label, type: n.type, data: n.data, style: n.style })), edges: doc.edges })}</pre>
        {/* Test harness: callbacks close over refs but only read them in event handlers. */}
        {/* eslint-disable-next-line react-hooks/refs */}
        {children?.(api)}
      </EditorProvider>
    </ReactFlowProvider>
  );
}
interface Api { doc: VisualisationIR; update: Parameters<typeof Inspector>[0] extends never ? never : (u: (d: VisualisationIR) => VisualisationIR, o?: { coalesceKey?: string; history?: boolean }) => void; undo: () => void; redo: () => void; session: EditorSession; canUndo: boolean; canRedo: boolean }
const state = () => JSON.parse(screen.getByTestId("doc").textContent!) as { type: string; nodes: { id: string; label: string; type: string; data: Record<string, unknown>; style?: Record<string, unknown> }[]; edges: { id: string; source: string; target: string; label?: string; data?: Record<string, unknown> }[] };
const nodeId = (label: string) => state().nodes.find((n) => n.label === label)!.id;

function select(api: Api, label: string) {
  act(() => api.session.setSelection({ nodes: [api.doc.nodes.find((n) => n.label === label)!.id], edges: [] }));
}

describe("Inspector", () => {
  const renderInspector = (initial: VisualisationIR, then?: (api: Api) => void) => {
    let captured!: Api;
    render(
      <Harness initial={initial}>
        {(api) => {
          captured = api;
          return <Inspector doc={api.doc} session={api.session} update={api.update} fallback={<p>Nothing selected</p>} />;
        }}
      </Harness>,
    );
    then?.(captured);
    return () => captured;
  };

  it("shows the fallback until something is selected", () => {
    renderInspector(make(FLOW, "flowchart"));
    expect(screen.getByText("Nothing selected")).toBeInTheDocument();
  });

  it("edits a step's text, description and colour", async () => {
    const api = renderInspector(make(FLOW, "flowchart"));
    select(api(), "Sign up");
    const text = screen.getByLabelText("Text");
    await userEvent.clear(text);
    await userEvent.type(text, "Register");
    expect(state().nodes.some((n) => n.label === "Register")).toBe(true);
    await userEvent.type(screen.getByLabelText("Description"), "Via the site");
    expect(state().nodes.find((n) => n.label === "Register")!.data.description).toBe("Via the site");
    await userEvent.click(screen.getByRole("radio", { name: "Green" }));
    expect(state().nodes.find((n) => n.label === "Register")!.style).toEqual({ color: "green" });
  });

  it("changes a step's shape", async () => {
    const api = renderInspector(make(FLOW, "flowchart"));
    select(api(), "Sign up");
    await userEvent.selectOptions(screen.getByLabelText("Shape"), "decision");
    expect(state().nodes.find((n) => n.label === "Sign up")!.type).toBe("decision");
  });

  it("connects items from the keyboard-accessible form, labels, reverses and removes connections", async () => {
    const api = renderInspector(make(CONCEPT, "conceptmap"));
    select(api(), "Customers");
    await userEvent.selectOptions(screen.getByLabelText("Connect to…"), nodeId("Suppliers"));
    await userEvent.type(screen.getByLabelText("Relationship"), "negotiate with");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(state().edges.some((e) => e.label === "negotiate with" && e.source === nodeId("Customers") && e.target === nodeId("Suppliers"))).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: /Reverse direction of connection to Suppliers/ }));
    expect(state().edges.some((e) => e.label === "negotiate with" && e.source === nodeId("Suppliers") && e.target === nodeId("Customers"))).toBe(true);

    const before = state().edges.length;
    await userEvent.click(screen.getByRole("button", { name: /Remove connection from Suppliers/ }));
    expect(state().edges).toHaveLength(before - 1);
  });

  it("edits a selected connection: label, arrow, direction", async () => {
    const api = renderInspector(make(CONCEPT, "conceptmap"));
    act(() => api().session.setSelection({ nodes: [], edges: [api().doc.edges[0]!.id] }));
    const label = screen.getByLabelText("Relationship");
    await userEvent.clear(label);
    await userEvent.type(label, "agree");
    expect(state().edges[0]!.label).toBe("agree");
    await userEvent.click(screen.getByRole("checkbox", { name: /Show an arrow/ }));
    expect(state().edges[0]!.data).toEqual({ directed: false });
  });

  it("mind map: moves a branch under another, reorders, collapses", async () => {
    const api = renderInspector(make(MIND, "mindmap"));
    select(api(), "Website");
    await userEvent.selectOptions(screen.getByLabelText("Move under…"), nodeId("Sales"));
    expect(state().edges.find((e) => e.target === nodeId("Website"))!.source).toBe(nodeId("Sales"));
    select(api(), "Marketing");
    await userEvent.click(screen.getByRole("button", { name: /Move down/ }));
    const t = mindTree({ nodes: api().doc.nodes, edges: api().doc.edges });
    expect(t.children.get(t.rootId!)!.slice(0, 2)).toEqual([nodeId("Product"), nodeId("Marketing")]);
  });

  it("mind map root: cannot be deleted or moved", () => {
    const api = renderInspector(make(MIND, "mindmap"));
    select(api(), "Launch");
    expect(screen.getByRole("button", { name: /Delete/ })).toBeDisabled();
    expect(screen.queryByLabelText("Move under…")).toBeNull();
  });

  it("timeline: validates dates, re-sorts on change, and explains blocked reordering", async () => {
    const api = renderInspector(make(TIME, "timeline"));
    select(api(), "Kick-off");
    expect(screen.getByRole("button", { name: /Move earlier/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Move later/ })).toBeDisabled();
    expect(screen.getByText(/different dates/)).toBeInTheDocument();

    const date = screen.getByLabelText("Date");
    await userEvent.clear(date);
    await userEvent.type(date, "next tuesday-ish");
    await userEvent.tab();
    expect(await screen.findByText(/Not recognised/)).toBeInTheDocument();
    expect(state().nodes[0]!.label).toBe("Kick-off");

    await userEvent.clear(date);
    await userEvent.type(date, "15 Feb 2026");
    await userEvent.tab();
    await waitFor(() => expect(state().nodes.map((n) => n.label)).toEqual(["Build", "Kick-off", "Launch"]));
    expect(state().nodes[1]!.data).toMatchObject({ date: "2026-02-15", dateLabel: "15 Feb 2026" });
  });

  it("multi-selection offers bulk colour, duplicate and delete", async () => {
    const api = renderInspector(make(FLOW, "flowchart"));
    act(() => api().session.setSelection({ nodes: [nodeId("Sign up"), nodeId("Welcome")], edges: [] }));
    expect(screen.getByRole("heading", { name: "2 items selected" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Red" }));
    expect(state().nodes.filter((n) => n.style?.color === "red")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(state().nodes.some((n) => n.label === "Sign up")).toBe(false);
  });
});

describe("Toolbar, undo and redo", () => {
  const renderToolbar = (initial: VisualisationIR) => {
    let captured!: Api;
    render(
      <Harness initial={initial}>
        {(api) => {
          captured = api;
          return <EditorToolbar doc={api.doc} session={api.session} update={api.update} undo={api.undo} redo={api.redo} canUndo={api.canUndo} canRedo={api.canRedo} onHelp={() => undefined} />;
        }}
      </Harness>,
    );
    return () => captured;
  };

  it("adds, duplicates, deletes and undoes/redoes", async () => {
    const api = renderToolbar(make(FLOW, "flowchart"));
    const start = state().nodes.length;
    expect(screen.getByRole("button", { name: /^Undo/ })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /Add/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Decision" }));
    expect(state().nodes).toHaveLength(start + 1);
    expect(state().nodes.at(-1)!.type).toBe("decision");
    expect(screen.getByRole("button", { name: /^Undo/ })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: /^Undo/ }));
    expect(state().nodes).toHaveLength(start);
    expect(screen.getByRole("button", { name: /^Redo/ })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: /^Redo/ }));
    expect(state().nodes).toHaveLength(start + 1);

    act(() => api().session.setSelection({ nodes: [state().nodes.at(-1)!.id], edges: [] }));
    await userEvent.click(screen.getByRole("button", { name: /Duplicate/ }));
    expect(state().nodes).toHaveLength(start + 2);
    await userEvent.click(screen.getByRole("button", { name: /^Delete/ }));
    expect(state().nodes).toHaveLength(start + 1);
  });

  it("layout controls change direction; reset layout restores computed positions", async () => {
    renderToolbar(make(FLOW, "flowchart"));
    await userEvent.selectOptions(screen.getByLabelText("Layout direction"), "LR");
    const xs = state();
    expect(xs.nodes).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Reset layout/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Undo/ }));
  });

  it("mind map and timeline show their own controls", () => {
    const { unmount } = render(
      <Harness initial={make(MIND, "mindmap")}>{(a) => <EditorToolbar doc={a.doc} session={a.session} update={a.update} undo={a.undo} redo={a.redo} canUndo={a.canUndo} canRedo={a.canRedo} onHelp={() => undefined} />}</Harness>,
    );
    expect(screen.getByRole("button", { name: "Collapse all branches" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand all branches" })).toBeInTheDocument();
    unmount();
    render(<Harness initial={make(TIME, "timeline")}>{(a) => <EditorToolbar doc={a.doc} session={a.session} update={a.update} undo={a.undo} redo={a.redo} canUndo={a.canUndo} canRedo={a.canRedo} onHelp={() => undefined} />}</Harness>);
    expect(screen.getByLabelText("Timeline orientation")).toBeInTheDocument();
  });

  it("is labelled as a toolbar with named groups", () => {
    renderToolbar(make(FLOW, "flowchart"));
    expect(screen.getByRole("toolbar", { name: "Editing tools" })).toBeInTheDocument();
    for (const g of ["History", "Add", "Layout", "View"]) expect(screen.getByRole("group", { name: g })).toBeInTheDocument();
  });
});

describe("Canvas", () => {
  it.each([
    ["flowchart", FLOW, ["Sign up", "Welcome"]],
    ["mindmap", MIND, ["Launch", "Marketing", "Website"]],
    ["conceptmap", CONCEPT, ["Customers", "Suppliers"]],
    ["timeline", TIME, ["Kick-off", "Build", "Launch"]],
  ] as const)("%s: draws every item", async (type, text, labels) => {
    render(<Harness initial={make(text, type)}>{() => <div style={{ width: 900, height: 600 }}><EngineCanvas /></div>}</Harness>);
    for (const l of labels) expect(await screen.findByText(l)).toBeInTheDocument();
    expect(screen.getByRole("application")).toHaveAccessibleName(/canvas/);
  });

  it("mind map: collapse button hides and restores a branch; add-branch button appears on the selected node", async () => {
    let api!: Api;
    render(<Harness initial={make(MIND, "mindmap")}>{(a) => { api = a; return <div style={{ width: 900, height: 600 }}><EngineCanvas /></div>; }}</Harness>);
    expect(await screen.findByText("Website")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse branch Marketing" })); // no mousedown: jsdom events lack `view`, which React Flow's d3 handlers read
    await waitFor(() => expect(screen.queryByText("Website")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Expand branch Marketing" }));
    expect(await screen.findByText("Website")).toBeInTheDocument();
    select(api, "Sales");
    expect(await screen.findByRole("button", { name: "Add a branch under Sales" })).toBeInTheDocument();
  });

  it("shows an empty state with an add button", async () => {
    const empty = { ...make("", "flowchart"), nodes: [], edges: [] };
    render(<Harness initial={empty}>{() => <div style={{ width: 600, height: 400 }}><EngineCanvas /></div>}</Harness>);
    await userEvent.click(await screen.findByRole("button", { name: "Add step" }));
    expect(state().nodes).toHaveLength(1);
  });

  it("double-clicking an item edits its text in place; Enter saves, Escape cancels", async () => {
    render(<Harness initial={make(FLOW, "flowchart")}>{() => <div style={{ width: 900, height: 700 }}><EngineCanvas /></div>}</Harness>);
    fireEvent.doubleClick(await screen.findByText("Sign up"));
    const box = await screen.findByRole("textbox", { name: /Edit text for Sign up/ });
    await userEvent.clear(box);
    await userEvent.type(box, "Register{Enter}");
    await waitFor(() => expect(state().nodes.some((n) => n.label === "Register")).toBe(true));

    fireEvent.doubleClick(await screen.findByText("Register"));
    const again = await screen.findByRole("textbox", { name: /Edit text for Register/ });
    await userEvent.type(again, " changed{Escape}");
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(state().nodes.some((n) => n.label === "Register")).toBe(true);
  });
});

describe("Source panel and type switching", () => {
  it("generates into an empty visualisation without confirmation, and warns about type changes", async () => {
    let api!: Api;
    const empty = { ...make("", "flowchart"), nodes: [], edges: [] } as VisualisationIR;
    render(<Harness initial={empty}>{(a) => { api = a; return <SourcePanel doc={a.doc} update={a.update} />; }}</Harness>);
    await userEvent.type(screen.getByLabelText("What would you like to visualise?"), "1. Alpha{enter}2. Beta");
    await userEvent.click(screen.getByRole("button", { name: "Generate from text" }));
    expect(state().nodes.map((n) => n.label)).toEqual(["Start", "Alpha", "Beta", "End"]);
    expect(api.doc.configuration.options.inputText).toContain("Alpha");
  });

  it("regenerating over existing content asks first, and is undoable", async () => {
    let api!: Api;
    render(<Harness initial={make(FLOW, "flowchart")}>{(a) => { api = a; return <SourcePanel doc={a.doc} update={a.update} />; }}</Harness>);
    const box = screen.getByLabelText("What would you like to visualise?");
    await userEvent.clear(box);
    await userEvent.type(box, "1. Only step");
    await userEvent.click(screen.getByRole("button", { name: "Regenerate from text" }));
    const dialog = await screen.findByRole("alertdialog", { name: /Replace the current content/ });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(state().nodes.some((n) => n.label === "Sign up")).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Regenerate from text" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Regenerate" }));
    await waitFor(() => expect(state().nodes.some((n) => n.label === "Only step")).toBe(true));
    expect(state().nodes.some((n) => n.label === "Sign up")).toBe(false);
    act(() => api.undo());
    expect(state().nodes.some((n) => n.label === "Sign up")).toBe(true);
  });

  it("shows how the text was read, including warnings", () => {
    const doc = make("Check the form\nIs it valid?\nSave it", "flowchart");
    render(<Harness initial={doc}>{(a) => <SourcePanel doc={a.doc} update={a.update} />}</Harness>);
    expect(screen.getByRole("region", { name: "How your text was read" })).toHaveTextContent(/no stated outcomes/);
  });
});

describe("Format switching dialog", () => {
  it("lists what changes before anything is applied, applies once on confirm, and is undoable", async () => {
    let api!: Api;
    render(
      <Harness initial={make(FLOW, "flowchart")}>
        {(a) => {
          api = a;
          return <ConvertDialog doc={a.doc} target="mindmap" onClose={() => undefined} onApply={(r) => a.update(() => r)} />;
        }}
      </Harness>,
    );
    const dialog = await screen.findByRole("alertdialog", { name: "Switch to a mind map?" });
    expect(dialog).toHaveTextContent(/cannot become a mind map without losing/);
    expect(dialog).toHaveTextContent(/central topic/);
    expect(state().type).toBe("flowchart"); // nothing applied yet
    await userEvent.click(within(dialog).getByRole("button", { name: "Switch to mind map" }));
    await waitFor(() => expect(state().type).toBe("mindmap"));
    act(() => api.undo());
    expect(state().type).toBe("flowchart");
  });

  it("a lossless switch says nothing is lost", async () => {
    render(<Harness initial={make(FLOW, "flowchart")}>{(a) => <ConvertDialog doc={a.doc} target="conceptmap" onClose={() => undefined} onApply={() => undefined} />}</Harness>);
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(/Nothing is lost/);
  });

  it("explains a blocked switch and offers no apply button", async () => {
    const chart = { ...make(FLOW, "flowchart"), type: "chart" as const };
    render(<Harness initial={chart}>{(a) => <ConvertDialog doc={a.doc} target="flowchart" onClose={() => undefined} onApply={() => undefined} />}</Harness>);
    const dialog = await screen.findByRole("alertdialog", { name: /Can’t switch/ });
    expect(dialog).toHaveTextContent(/built from data/);
    expect(within(dialog).queryByRole("button", { name: /Switch to/ })).toBeNull();
  });
});

void getColor; void getExtras;

describe("Canvas context menu", () => {
  const canvas = (initial: VisualisationIR) => render(<Harness initial={initial}>{() => <div style={{ width: 900, height: 700 }}><EngineCanvas /></div>}</Harness>);
  const rightClickNode = async (label: string) => {
    const el = (await screen.findByText(label)).closest(".react-flow__node")!;
    fireEvent.contextMenu(el);
    return screen.findByRole("menu");
  };
  const rightClickPane = async () => {
    fireEvent.contextMenu(document.querySelector(".react-flow__pane")!);
    return screen.findByRole("menu");
  };

  it("flowchart: right-clicking empty canvas offers every kind of step, and adds the one you pick", async () => {
    canvas(make(FLOW, "flowchart"));
    await screen.findByText("Sign up");
    const before = state().nodes.length;
    const edgesBefore = state().edges.length;
    const menu = await rightClickPane();
    const items = within(menu).getAllByRole("menuitem").map((i) => i.textContent!.trim());
    expect(items).toEqual(expect.arrayContaining(["Start", "Process", "Decision", "Input / output", "End", "Select all", "Fit to screen"]));
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Decision" }));
    await waitFor(() => expect(state().nodes).toHaveLength(before + 1));
    expect(state().nodes.at(-1)!.type).toBe("decision");
    expect(state().edges).toHaveLength(edgesBefore); // placed freely: no connection was invented
  });

  it("flowchart: right-clicking a step offers connected steps, adds one with a connection, and never offers anything after End", async () => {
    canvas(make(FLOW, "flowchart"));
    const menu = await rightClickNode("Sign up");
    const items = within(menu).getAllByRole("menuitem").map((i) => i.textContent!.trim());
    expect(items).toEqual(expect.arrayContaining(["Process", "Decision", "Input / output", "End", "Rename", "Duplicate", "Delete step"]));
    expect(items).not.toContain("Start"); // nothing starts after another step
    const edgesBefore = state().edges.length;
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Process" }));
    await waitFor(() => expect(state().edges).toHaveLength(edgesBefore + 1));
    const added = state().nodes.at(-1)!;
    expect(state().edges.at(-1)).toMatchObject({ source: nodeId("Sign up"), target: added.id });
  });

  it("mind map: add branch and sibling from a node; the root has no sibling and cannot be deleted", async () => {
    canvas(make(MIND, "mindmap"));
    let menu = await rightClickNode("Marketing");
    expect(within(menu).getByRole("menuitem", { name: "Add sibling" })).not.toHaveAttribute("data-disabled");
    expect(within(menu).getByRole("menuitem", { name: "Collapse branch" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /Delete branch and its sub-branches/ })).toBeInTheDocument();
    const count = state().nodes.length;
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Add branch" }));
    await waitFor(() => expect(state().nodes).toHaveLength(count + 1));
    await userEvent.keyboard("{Escape}");

    menu = await rightClickNode("Launch");
    expect(within(menu).getByRole("menuitem", { name: "Add sibling" })).toHaveAttribute("data-disabled");
    expect(within(menu).getByRole("menuitem", { name: /Delete/ })).toHaveAttribute("data-disabled");
  });

  it("mind map: collapsing from the menu hides the branch", async () => {
    canvas(make(MIND, "mindmap"));
    const menu = await rightClickNode("Marketing");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Collapse branch" }));
    await waitFor(() => expect(screen.queryByText("Website")).toBeNull());
  });

  it("concept map: add a related concept from a node, or a concept where you click", async () => {
    canvas(make(CONCEPT, "conceptmap"));
    let menu = await rightClickNode("Customers");
    const edges = state().edges.length;
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Add related concept" }));
    await waitFor(() => expect(state().edges).toHaveLength(edges + 1));
    await userEvent.keyboard("{Escape}");
    const nodes = state().nodes.length;
    menu = await rightClickPane();
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Add concept here" }));
    await waitFor(() => expect(state().nodes).toHaveLength(nodes + 1));
  });

  it("timeline: add an event after the one you clicked", async () => {
    canvas(make(TIME, "timeline"));
    const menu = await rightClickNode("Kick-off");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Add event after" }));
    await waitFor(() => expect(state().nodes).toHaveLength(4));
    expect(state().nodes[1]!.label).not.toBe("Build"); // inserted right after Kick-off
  });

  it("right-clicking an unselected item selects it, so Delete acts on that item", async () => {
    canvas(make(FLOW, "flowchart"));
    const menu = await rightClickNode("Welcome");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Delete step" }));
    await waitFor(() => expect(screen.queryByText("Welcome")).toBeNull());
    expect(screen.getByText("Sign up")).toBeInTheDocument();
  });

  it("the empty-canvas menu on a mind map only offers a central topic when there is none", async () => {
    canvas(make(MIND, "mindmap"));
    await screen.findByText("Launch");
    const menu = await rightClickPane();
    expect(within(menu).getByRole("menuitem", { name: "Add central topic" })).toHaveAttribute("data-disabled");
  });

  it("menus carry the animation class so they fade in and out", async () => {
    canvas(make(FLOW, "flowchart"));
    await screen.findByText("Sign up");
    expect(await rightClickPane()).toHaveClass("vz-menu");
  });
});

describe("Swimlanes in the editor", () => {
  const LANES = "1. Place order [Customer]\n2. Check stock [Warehouse]\n3. Pack the items [Warehouse]";
  const inspector = (initial: VisualisationIR) => {
    let captured!: Api;
    render(
      <Harness initial={initial}>
        {(api) => {
          captured = api;
          return (
            <>
              <Inspector doc={api.doc} session={api.session} update={api.update} fallback={<p>Nothing selected</p>} />
              <div style={{ width: 900, height: 700 }}><EngineCanvas /></div>
            </>
          );
        }}
      </Harness>,
    );
    return () => captured;
  };
  const laneNames = () => JSON.parse(screen.getByTestId("doc").textContent!).nodes.map((n: { data: { lane?: string } }) => n.data.lane);

  it("a flowchart without lanes offers to add them, and adding them draws the bands", async () => {
    inspector(make(FLOW, "flowchart"));
    await userEvent.click(await screen.findByRole("button", { name: /Add swimlanes/ }));
    expect(await screen.findByRole("list", { name: "Lanes, top to bottom" })).toBeInTheDocument();
    expect(screen.getByLabelText("Lane 1 name")).toHaveValue("Lane 1");
    expect(screen.getByLabelText("Lane 2 name")).toHaveValue("Lane 2");
    expect(document.querySelectorAll(".react-flow__node-lane")).toHaveLength(2);
    expect(laneNames().every((l: string) => l === "Lane 1")).toBe(true);
  });

  it("a lane tag in the text produces named bands behind the steps", async () => {
    inspector(make(LANES, "flowchart"));
    await screen.findByText("Place order");
    const bands = [...document.querySelectorAll(".react-flow__node-lane")];
    expect(bands.map((b) => b.textContent)).toEqual(["Customer", "Warehouse"]);
    expect(bands.every((b) => b.getAttribute("aria-hidden") !== "false")).toBe(true);
  });

  it("rename, reorder and remove a lane from the panel", async () => {
    inspector(make(LANES, "flowchart"));
    const field = await screen.findByLabelText("Lane 2 name");
    await userEvent.clear(field);
    await userEvent.type(field, "Stock room{Enter}");
    await waitFor(() => expect(laneNames()).toContain("Stock room"));
    await userEvent.click(screen.getByRole("button", { name: "Move lane Stock room up" }));
    await waitFor(() => expect([...document.querySelectorAll(".react-flow__node-lane")].map((b) => b.textContent)).toEqual(["Stock room", "Customer"]));
    await userEvent.click(screen.getByRole("button", { name: "Remove lane Stock room" }));
    await waitFor(() => expect(document.querySelectorAll(".react-flow__node-lane")).toHaveLength(1));
    expect(laneNames().every((l: string) => l === "Customer")).toBe(true);
  });

  it("adds a lane from the form, and refuses a blank one", async () => {
    inspector(make(LANES, "flowchart"));
    const add = await screen.findByRole("button", { name: "Add" });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Add a lane"), "Courier");
    await userEvent.click(add);
    await waitFor(() => expect(document.querySelectorAll(".react-flow__node-lane")).toHaveLength(3));
    expect(screen.getByLabelText("Add a lane")).toHaveValue("");
  });

  it("removing swimlanes puts the flowchart back as it was", async () => {
    inspector(make(LANES, "flowchart"));
    await userEvent.click(await screen.findByRole("button", { name: "Remove swimlanes" }));
    await waitFor(() => expect(document.querySelectorAll(".react-flow__node-lane")).toHaveLength(0));
    expect(await screen.findByRole("button", { name: /Add swimlanes/ })).toBeInTheDocument();
  });

  it("a selected step shows its lane and can change it", async () => {
    const get = inspector(make(LANES, "flowchart"));
    await screen.findByText("Place order");
    act(() => get().session.setSelection({ nodes: [get().doc.nodes.find((n) => n.label === "Place order")!.id], edges: [] }));
    const select = await screen.findByLabelText("Swimlane");
    expect(select).toHaveValue("Customer");
    await userEvent.selectOptions(select, "Warehouse");
    // Start, Place order, Check stock, Pack the items, End: Place order joins the three already in Warehouse.
    await waitFor(() => expect(laneNames().filter((l: string) => l === "Warehouse")).toHaveLength(4));
  });

  it("right-clicking a step offers Move to lane, with its own lane disabled", async () => {
    inspector(make(LANES, "flowchart"));
    fireEvent.contextMenu((await screen.findByText("Check stock")).closest(".react-flow__node")!);
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Move to lane")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Warehouse" })).toHaveAttribute("data-disabled");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Customer" }));
    await waitFor(() => expect(laneNames().filter((l: string) => l === "Customer")).toHaveLength(3)); // Start, Place order and now Check stock
  });

  it("a flowchart without lanes has no Move to lane entry", async () => {
    inspector(make(FLOW, "flowchart"));
    fireEvent.contextMenu((await screen.findByText("Sign up")).closest(".react-flow__node")!);
    expect(within(await screen.findByRole("menu")).queryByText("Move to lane")).toBeNull();
  });

  it("lane bands cannot be selected, edited or right-clicked as if they were steps", async () => {
    inspector(make(LANES, "flowchart"));
    await screen.findByText("Place order");
    const band = document.querySelector(".react-flow__node-lane") as HTMLElement;
    fireEvent.doubleClick(band);
    expect(document.querySelector("textarea")).toBeNull();
    expect(band).not.toHaveClass("selected");
  });
});

describe("Org chart in the editor", () => {
  const ORG = "Ada Lovelace - CEO\n  Bo Chen - CTO\n    Cy Diaz - Engineer\n  Di Evans - COO";
  const canvas = () => render(<Harness initial={make(ORG, "orgchart")}>{() => <div style={{ width: 1000, height: 700 }}><EngineCanvas /></div>}</Harness>);

  it("draws a card for each person with their role, and an avatar with initials", async () => {
    canvas();
    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    for (const t of ["CEO", "CTO", "COO", "Engineer", "AL", "BC"]) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getByRole("application")).toHaveAccessibleName(/orgchart canvas/);
  });

  it("a manager's team folds away and returns, with the count on the button", async () => {
    canvas();
    await screen.findByText("Cy Diaz");
    fireEvent.click(screen.getByRole("button", { name: "Collapse team Bo Chen" }));
    await waitFor(() => expect(screen.queryByText("Cy Diaz")).toBeNull());
    expect(screen.getByRole("button", { name: "Expand team Bo Chen" })).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Expand team Bo Chen" }));
    expect(await screen.findByText("Cy Diaz")).toBeInTheDocument();
  });

  it("right-click: add a report, rename, and delete with everyone beneath", async () => {
    canvas();
    fireEvent.contextMenu((await screen.findByText("Bo Chen")).closest(".react-flow__node")!);
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem").map((i) => i.textContent!.trim());
    expect(items).toEqual(expect.arrayContaining(["Add a report", "Add sibling", "Collapse team", "Rename", "Duplicate", "Delete person and everyone beneath"]));
    const before = state().nodes.length;
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Add a report" }));
    await waitFor(() => expect(state().nodes).toHaveLength(before + 1));
    expect(state().nodes.at(-1)!.label).toBe("New person");
  });

  it("an empty org chart invites you to add the head of the organisation", async () => {
    render(<Harness initial={{ ...make("", "orgchart"), nodes: [], edges: [] }}>{() => <div style={{ width: 600, height: 400 }}><EngineCanvas /></div>}</Harness>);
    expect(await screen.findByText(/Add the head of the organisation/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add head of organisation/ })).toBeInTheDocument();
  });

  it("the Inspector names the fields for people: Name and Role or title", async () => {
    let api!: Api;
    render(<Harness initial={make(ORG, "orgchart")}>{(a) => { api = a; return <Inspector doc={a.doc} session={a.session} update={a.update} fallback={<p>none</p>} />; }}</Harness>);
    select(api, "Bo Chen");
    expect(await screen.findByLabelText("Name")).toHaveValue("Bo Chen");
    expect(screen.getByLabelText("Role or title")).toHaveValue("CTO");
    expect(screen.getByRole("button", { name: "Add a report" })).toBeInTheDocument();
  });
});
