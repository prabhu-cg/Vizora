import type { Edge, Node } from "@xyflow/react";
import type { IREdge, IRNode } from "@/types/visualisation";

/**
 * IR ↔ React Flow adapters. React Flow shapes are view state only; the IR is
 * always what gets persisted.
 */
export function toFlowNodes(nodes: readonly IRNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type === "input" || n.type === "output" ? n.type : "default",
    position: { ...n.position },
    data: { label: n.label },
    ...(n.size ? { width: n.size.width, height: n.size.height } : {}),
  }));
}

export function toFlowEdges(edges: readonly IREdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.label ? { label: e.label } : {}),
  }));
}

/** Copy position changes from the view back onto IR nodes, leaving everything else untouched. */
export function applyPositions(nodes: readonly IRNode[], flowNodes: readonly Node[]): IRNode[] {
  const positions = new Map(flowNodes.map((n) => [n.id, n.position]));
  return nodes.map((n) => {
    const p = positions.get(n.id);
    return p && (p.x !== n.position.x || p.y !== n.position.y) ? { ...n, position: { x: p.x, y: p.y } } : n;
  });
}
