"use client";

import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnMoveEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { COLOR_VAR, getColor } from "@/lib/engine/semantics";
import { CanvasMenu, type MenuTarget } from "./canvas-menu";
import { isDecoration, toFlow } from "./flow-adapter";
import { useEditor } from "./context";
import { NODE_TYPES } from "./nodes";

const isDefaultView = (v: { x: number; y: number; zoom: number }) => v.x === 0 && v.y === 0 && v.zoom === 1;

const EMPTY_COPY = {
  flowchart: "This flowchart is empty. Add a step, or paste text into the Source panel and generate.",
  mindmap: "This mind map is empty. Add a central topic to begin.",
  orgchart: "This org chart is empty. Add the head of the organisation, then add the people who report to them, or paste an indented list into the Source panel.",
  conceptmap: "This concept map is empty. Add a concept, then connect concepts to describe how they relate.",
  timeline: "This timeline is empty. Add an event, or paste dated lines into the Source panel.",
} as const;

/**
 * The on-screen view of any engine visualisation. React Flow is purely a
 * projection of the IR: every change goes through the editor's pure
 * operations, so undo, autosave and exports all see exactly what you see.
 */
export function EngineCanvas() {
  const ed = useEditor();
  const { doc, selection } = ed;
  const [drag, setDrag] = useState<Record<string, { x: number; y: number }>>({});
  const flow = useMemo(() => toFlow(doc, selection, drag), [doc, selection, drag]);
  const rf = useReactFlow();
  const [menu, setMenu] = useState<MenuTarget>({ kind: "pane", position: { x: 0, y: 0 } });

  // First open of a freshly generated document: fit it to the screen once.
  useEffect(() => {
    if (!isDefaultView(doc.viewport)) return;
    const raf = requestAnimationFrame(() => void rf.fitView({ padding: 0.2, maxZoom: 1.1 }));
    return () => cancelAnimationFrame(raf);
    // Only on mount: later viewport changes are the user's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNodesChange = useCallback(
    (changes: Iterable<NodeChange>) => {
      let nodes = selection.nodes;
      let touchedSelection = false;
      for (const c of changes) {
        if (c.type === "position" && c.dragging && c.position) {
          const { id, position } = c;
          setDrag((prev) => ({ ...prev, [id]: position }));
        } else if (c.type === "select" && !isDecoration(c.id)) {
          touchedSelection = true;
          nodes = c.selected ? (nodes.includes(c.id) ? nodes : [...nodes, c.id]) : nodes.filter((id) => id !== c.id);
        }
      }
      if (touchedSelection) ed.setSelection({ nodes, edges: nodes.length ? [] : selection.edges });
    },
    [ed, selection],
  );

  const onEdgesChange = useCallback(
    (changes: Iterable<EdgeChange>) => {
      let edges = selection.edges;
      let touched = false;
      for (const c of changes) {
        if (c.type === "select") {
          touched = true;
          edges = c.selected ? (edges.includes(c.id) ? edges : [...edges, c.id]) : edges.filter((id) => id !== c.id);
        }
      }
      if (touched) ed.setSelection({ nodes: edges.length ? [] : selection.nodes, edges });
    },
    [ed, selection],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, __: Node, dragged: Node[]) => {
      ed.moveNodes(Object.fromEntries(dragged.map((n) => [n.id, n.position])));
      setDrag({});
    },
    [ed],
  );

  const onConnect = useCallback((c: Connection) => c.source && c.target && ed.connect(c.source, c.target), [ed]);
  const onMoveEnd: OnMoveEnd = useCallback((_e, v) => ed.setViewport({ x: v.x, y: v.y, zoom: v.zoom }), [ed]);

  const nodeColour = useCallback(
    (n: Node) => {
      const node = doc.nodes.find((x) => x.id === n.id);
      return node ? COLOR_VAR[getColor(node) === "default" ? "grey" : getColor(node)] : "var(--border-strong)";
    },
    [doc.nodes],
  );

  // Remember what was right-clicked; the menu (opened by the same event) reads it. A right-clicked item that is not
  // already selected becomes the selection, so Delete and Duplicate act on it.
  const onPaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => setMenu({ kind: "pane", position: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }) }), [rf]);
  const onNodeContextMenu = useCallback(
    (_: unknown, n: Node) => {
      if (isDecoration(n.id)) return;
      if (!selection.nodes.includes(n.id)) ed.setSelection({ nodes: [n.id], edges: [] });
      setMenu({ kind: "node", id: n.id });
    },
    [ed, selection.nodes],
  );
  const onEdgeContextMenu = useCallback(
    (_: unknown, edge: { id: string }) => {
      if (!selection.edges.includes(edge.id)) ed.setSelection({ nodes: [], edges: [edge.id] });
      setMenu({ kind: "edge", id: edge.id });
    },
    [ed, selection.edges],
  );

  const interactive = doc.type === "flowchart" || doc.type === "conceptmap";

  return (
    <ContextMenu>
    <ContextMenuTrigger asChild>
    <div data-editor-canvas className="vz-flow relative h-full min-h-96 w-full">
      <ReactFlow
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onMoveEnd={onMoveEnd}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeDoubleClick={(_, n) => !isDecoration(n.id) && ed.startEdit(n.id)}
        defaultViewport={doc.viewport}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={interactive}
        nodesConnectable={interactive}
        aria-label={`${doc.type} canvas. Tab to an item, then Enter to edit, Tab to add the next item, Delete to remove.`}
        deleteKeyCode={null}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={["Meta", "Control", "Shift"]}
        minZoom={0.1}
        maxZoom={3}
        zoomOnDoubleClick={false}
      >
        <Background color="var(--border-strong)" gap={22} size={1.2} />
        <Controls showInteractive={false} position="bottom-left" />
        {doc.nodes.length > 10 && <MiniMap pannable zoomable nodeColor={nodeColour} maskColor="var(--scrim)" ariaLabel="Overview map" className="!hidden md:!block" />}
      </ReactFlow>

      {doc.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
          <div className="pointer-events-auto max-w-sm rounded-card border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">{EMPTY_COPY[doc.type as keyof typeof EMPTY_COPY]}</p>
            <Button className="mt-4" size="sm" onClick={ed.addFirst}>
              <Plus aria-hidden="true" /> {doc.type === "mindmap" ? "Add central topic" : doc.type === "orgchart" ? "Add head of organisation" : doc.type === "timeline" ? "Add event" : doc.type === "conceptmap" ? "Add concept" : "Add step"}
            </Button>
          </div>
        </div>
      )}
    </div>
    </ContextMenuTrigger>
    <CanvasMenu target={menu} onFit={() => void rf.fitView({ padding: 0.2, maxZoom: 1.1, duration: 200 })} />
    </ContextMenu>
  );
}
