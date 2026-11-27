"use client";

import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Node,
  type OnMoveEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus } from "lucide-react";
import { useCallback, useRef } from "react";
import type { RendererProps } from "@/components/visualisations/registry";
import { Button } from "@/components/ui/button";
import { createId } from "@/lib/utils/id";
import { createNode } from "@/lib/visualisation/factory";
import { applyPositions, toFlowEdges, toFlowNodes } from "./adapter";

/**
 * React Flow view over the IR. React Flow holds transient view state (drag
 * in progress); every committed change is written back to the IR, which is the
 * only thing persisted.
 */
export default function DiagramRenderer({ document: doc, onChange }: RendererProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(toFlowNodes(doc.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(doc.edges));
  const counter = useRef(doc.nodes.length);

  const addNode = useCallback(() => {
    counter.current += 1;
    const offset = (counter.current % 8) * 28;
    const node = createNode({
      label: `Node ${counter.current}`,
      position: { x: 120 + offset, y: 80 + offset },
    });
    setNodes((prev) => [...prev, ...toFlowNodes([node])]);
    onChange((d) => ({ ...d, nodes: [...d.nodes, node] }));
  }, [onChange, setNodes]);

  const onNodeDragStop = useCallback(
    (_: unknown, __: Node, dragged: Node[]) => {
      onChange((d) => ({ ...d, nodes: applyPositions(d.nodes, dragged) }));
    },
    [onChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const edge = { id: createId(), source: connection.source, target: connection.target };
      setEdges((prev) => addEdge({ ...connection, id: edge.id }, prev));
      onChange((d) => ({ ...d, edges: [...d.edges, edge] }));
    },
    [onChange, setEdges],
  );

  const onDelete = useCallback(
    ({ nodes: gone, edges: goneEdges }: { nodes: Node[]; edges: { id: string }[] }) => {
      const nodeIds = new Set(gone.map((n) => n.id));
      const edgeIds = new Set(goneEdges.map((e) => e.id));
      onChange((d) => ({
        ...d,
        nodes: d.nodes.filter((n) => !nodeIds.has(n.id)),
        edges: d.edges.filter((e) => !edgeIds.has(e.id) && !nodeIds.has(e.source) && !nodeIds.has(e.target)),
      }));
    },
    [onChange],
  );

  const onMoveEnd: OnMoveEnd = useCallback(
    (_event, viewport) => {
      onChange((d) => {
        const v = d.viewport;
        const same = v.x === viewport.x && v.y === viewport.y && v.zoom === viewport.zoom;
        return same ? d : { ...d, viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom } };
      });
    },
    [onChange],
  );

  return (
    <div className="vz-flow relative h-full min-h-96 w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onDelete={onDelete}
        onMoveEnd={onMoveEnd}
        defaultViewport={doc.viewport}
        minZoom={0.1}
        maxZoom={4}
        deleteKeyCode={["Backspace", "Delete"]}
        aria-label="Diagram canvas. Tab to a node, use arrow keys to move it, Delete to remove it."
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border-strong)" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable ariaLabel="Diagram overview" nodeColor="var(--primary)" maskColor="var(--scrim)" className="!hidden md:!block" />
      </ReactFlow>
      <div className="absolute left-3 top-3 z-10">
        <Button size="sm" variant="outline" onClick={addNode}>
          <Plus aria-hidden="true" /> Add node
        </Button>
      </div>
      {nodes.length === 0 && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
          This diagram is empty. Add a node to begin; drag from a node’s handle to connect.
        </p>
      )}
    </div>
  );
}
