import { getExtras, isEngineType } from "../semantics";
import { mindTree } from "../mindmap-tree";
import { defaultLayoutFor } from "@/lib/visualisation/defaults";
import type { IRNode, VisualisationIR } from "@/types/visualisation";
import { forceLayout } from "./force";
import { layeredLayout, type LNode } from "./layered";
import { measureNode } from "./size";
import { timelineLayout, type TimelineLayout } from "./timeline";
import { treeLayout } from "./tree";

export { measureNode } from "./size";

/** Give every node its measured size. Never changes positions. */
export function withSizes(doc: VisualisationIR): VisualisationIR {
  if (!isEngineType(doc.type)) return doc;
  const type = doc.type;
  return { ...doc, nodes: doc.nodes.map((n) => ({ ...n, size: measureNode(type, n) })) };
}

function lnodes(nodes: readonly IRNode[]): LNode[] {
  return nodes.map((n) => ({ id: n.id, width: n.size?.width ?? 140, height: n.size?.height ?? 44 }));
}

/** Pre-compute the timeline geometry (positions, axis, sides) for a sized document. */
export function timelineGeometry(doc: VisualisationIR): TimelineLayout {
  const dir = doc.layout.direction === "TB" || doc.layout.direction === "BT" ? "TB" : "LR";
  return timelineLayout(lnodes(doc.nodes), dir, dir === "LR" ? doc.layout.spacing.x : doc.layout.spacing.y);
}

/**
 * Compute positions for the whole document from its type and layout settings.
 * Deterministic. Chart and table types are returned unchanged.
 */
export function applyLayout(input: VisualisationIR): VisualisationIR {
  if (!isEngineType(input.type)) return input;
  const doc = withSizes(input);
  const ln = lnodes(doc.nodes);
  const gap = { gapX: doc.layout.spacing.x, gapY: doc.layout.spacing.y };
  let positions = new Map<string, { x: number; y: number }>();

  switch (doc.type) {
    case "mindmap": {
      const tree = mindTree(doc);
      const collapsed = new Set(doc.nodes.filter((n) => getExtras(n).collapsed).map((n) => n.id));
      if (tree.rootId) {
        const r = treeLayout(ln, tree.children, tree.rootId, collapsed, gap);
        positions = r.positions;
        // Place stray nodes (no path to root) below the map so nothing overlaps.
        const maxY = Math.max(0, ...[...r.positions.entries()].map(([id, p]) => p.y + (doc.nodes.find((n) => n.id === id)?.size?.height ?? 0)));
        let x = 0;
        for (const n of doc.nodes) {
          if (!positions.has(n.id) && !r.hidden.has(n.id)) {
            positions.set(n.id, { x, y: maxY + 60 });
            x += (n.size?.width ?? 140) + 24;
          }
        }
      }
      break;
    }
    case "timeline":
      positions = timelineGeometry(doc).positions;
      break;
    case "conceptmap":
      positions =
        doc.layout.algorithm === "force"
          ? forceLayout(ln, doc.edges, gap)
          : layeredLayout(ln, doc.edges, { direction: doc.layout.direction, ...gap });
      break;
    default:
      positions = layeredLayout(ln, doc.edges, { direction: doc.layout.direction, ...gap });
  }

  const nodes = doc.nodes.map((n) => {
    const p = positions.get(n.id);
    return p ? { ...n, position: { x: Math.round(p.x), y: Math.round(p.y) } } : n;
  });
  return { ...doc, nodes, layout: { ...doc.layout, algorithm: doc.layout.algorithm === "manual" ? defaultLayoutFor(doc.type).algorithm : doc.layout.algorithm } };
}
