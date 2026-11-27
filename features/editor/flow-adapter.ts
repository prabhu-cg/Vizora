import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { connectionSides, rectOf } from "@/lib/engine/edges";
import { timelineGeometry } from "@/lib/engine";
import { hiddenNodeIds } from "@/lib/engine/ops";
import { mindTree } from "@/lib/engine/mindmap-tree";
import { COLOR_VAR, getColor, isDirected, isEngineType } from "@/lib/engine/semantics";
import type { VisualisationIR } from "@/types/visualisation";
import type { Selection } from "./context";

export interface ItemData extends Record<string, unknown> {
  /** Only present for timeline cards. */
  side?: "before" | "after";
  /** Mind map: outward direction and number of children. */
  outward?: "left" | "right";
  childCount?: number;
  isRoot?: boolean;
}

export interface AxisData extends Record<string, unknown> {
  length: number;
  horizontal: boolean;
}

export const AXIS_ID = "__axis";

const kindLabel = (n: { type: string; label: string }) => `${n.type}: ${n.label}`;

/**
 * IR → React Flow view model. Pure: React Flow never owns document state, it is
 * a projection of the IR plus transient drag positions and selection.
 */
export function toFlow(
  doc: VisualisationIR,
  selection: Selection,
  overrides: Readonly<Record<string, { x: number; y: number }>> = {},
): { nodes: Node<ItemData | AxisData>[]; edges: Edge[] } {
  if (!isEngineType(doc.type)) return { nodes: [], edges: [] };
  const hidden = hiddenNodeIds(doc);
  const selectedNodes = new Set(selection.nodes);
  const selectedEdges = new Set(selection.edges);
  const tree = doc.type === "mindmap" ? mindTree(doc) : undefined;
  const geo = doc.type === "timeline" ? timelineGeometry(doc) : undefined;
  const rootRect = tree?.rootId ? rectOf(tree.byId.get(tree.rootId)!) : undefined;
  const draggable = doc.type === "flowchart" || doc.type === "conceptmap";

  const nodes: Node<ItemData | AxisData>[] = [];
  if (geo) {
    const horizontal = doc.layout.direction !== "TB" && doc.layout.direction !== "BT";
    const { x1, y1, x2, y2 } = geo.axis;
    nodes.push({
      id: AXIS_ID,
      type: "axis",
      position: { x: Math.min(x1, x2), y: Math.min(y1, y2) },
      data: { length: horizontal ? Math.abs(x2 - x1) : Math.abs(y2 - y1), horizontal },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
    });
  }

  for (const n of doc.nodes) {
    if (hidden.has(n.id)) continue;
    const r = rectOf(n);
    const data: ItemData = {};
    if (geo) data.side = geo.sides.get(n.id);
    if (tree) {
      data.childCount = tree.children.get(n.id)?.length ?? 0;
      data.isRoot = n.id === tree.rootId;
      data.outward = rootRect && r.x + r.width / 2 < rootRect.x + rootRect.width / 2 ? "left" : "right";
    }
    nodes.push({
      id: n.id,
      type: "item",
      position: overrides[n.id] ?? n.position,
      width: r.width,
      height: r.height,
      data: { ...data, node: n } as ItemData,
      selected: selectedNodes.has(n.id),
      draggable,
      connectable: draggable,
      ariaLabel: kindLabel(n),
    });
  }

  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const edges: Edge[] = [];
  if (doc.type !== "timeline") {
    for (const e of doc.edges) {
      const a = byId.get(e.source), b = byId.get(e.target);
      if (!a || !b || hidden.has(a.id) || hidden.has(b.id)) continue;
      const ra = { ...rectOf(a), ...(overrides[a.id] ?? {}) };
      const rb = { ...rectOf(b), ...(overrides[b.id] ?? {}) };
      const sides = connectionSides(ra, rb);
      const colourKey = doc.type === "mindmap" ? getColor(b) : "default";
      const colour = doc.type === "mindmap" ? COLOR_VAR[colourKey === "default" ? "grey" : colourKey] : "var(--muted-foreground)";
      edges.push({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: sides.source,
        targetHandle: sides.target,
        label: e.label,
        selected: selectedEdges.has(e.id),
        ariaLabel: `${e.label ? `${e.label}: ` : ""}${a.label} to ${b.label}`,
        style: { stroke: colour, strokeWidth: doc.type === "mindmap" ? 2.2 : 1.6 },
        ...(isDirected(e, doc.type) ? { markerEnd: { type: MarkerType.ArrowClosed, color: colour, width: 18, height: 18 } } : {}),
        labelStyle: { fill: "var(--body)", fontSize: 12, fontFamily: "var(--font-sans)" },
        labelBgStyle: { fill: "var(--card)", stroke: "var(--border-strong)" },
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 11,
        interactionWidth: 24,
      });
    }
  }
  return { nodes, edges };
}
