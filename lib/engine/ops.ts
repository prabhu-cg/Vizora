import { createId } from "@/lib/utils/id";
import type { IREdge, IRNode, VisualisationIR } from "@/types/visualisation";
import { applyLayout, measureNode } from "./layout";
import { depthOf, descendants, mindTree } from "./mindmap-tree";
import {
  isTreeType,
  CATEGORY_CYCLE,
  DEFAULT_KIND,
  NODE_KINDS,
  getColor,
  getExtras,
  isEngineType,
  withColor,
  withExtras,
  type ColorKey,
  type EngineType,
  type NodeExtras,
} from "./semantics";
import { sortKeyOf } from "./interpret/dates";
import { laneAtCross, laneGeometry, laneIndexOf, readLanes } from "./lanes";

/**
 * Pure editing operations over the IR. Each returns a new document (or the
 * same reference when nothing changed). They know the rules of each type, so
 * the UI never has to: a mind map stays a tree, a timeline stays in order, a
 * flowchart's start/end rules are respected.
 *
 * Mind maps and timelines are laid out automatically after every structural
 * change; flowcharts and concept maps keep the user's manual positions.
 */
const AUTO: Record<string, boolean> = { mindmap: true, orgchart: true, timeline: true };
const engine = (doc: VisualisationIR): EngineType | undefined => (isEngineType(doc.type) ? doc.type : undefined);
const sized = (doc: VisualisationIR, n: IRNode): IRNode => (engine(doc) ? { ...n, size: measureNode(engine(doc)!, n) } : n);
const settle = (doc: VisualisationIR): VisualisationIR => (AUTO[doc.type] ? applyLayout(doc) : doc);

export const DEFAULT_LABEL: Record<string, string> = {
  start: "Start",
  end: "End",
  process: "New step",
  decision: "New decision?",
  io: "New input / output",
  topic: "Central topic",
  branch: "New branch",
  concept: "New concept",
  event: "New event",
  milestone: "New milestone",
};

/** Default text for a new tree item: people on an org chart, topics and branches on a mind map. */
const defaultLabel = (type: EngineType, kind: string): string =>
  type === "orgchart" ? (kind === "topic" ? "Head of the organisation" : "New person") : (DEFAULT_LABEL[kind] ?? "New item");

export interface AddOptions {
  kind?: string;
  label?: string;
  /** Existing node to attach to: flowchart/concept link from it; mind map parent; timeline insert after it. */
  from?: string;
  position?: { x: number; y: number };
  date?: string;
  dateLabel?: string;
  category?: string;
  description?: string;
}

export interface AddResult {
  doc: VisualisationIR;
  id: string;
}

function usedColours(doc: VisualisationIR, tree = mindTree(doc)): ColorKey[] {
  return (tree.rootId ? (tree.children.get(tree.rootId) ?? []) : []).map((id) => getColor(tree.byId.get(id)!));
}

function nextBranchColour(doc: VisualisationIR): ColorKey {
  const used = usedColours(doc);
  return CATEGORY_CYCLE.find((c) => !used.includes(c)) ?? CATEGORY_CYCLE[used.length % CATEGORY_CYCLE.length]!;
}

export function addNode(doc: VisualisationIR, opts: AddOptions = {}): AddResult {
  const type = engine(doc);
  if (!type) return { doc, id: "" };
  const kind = opts.kind && NODE_KINDS[type].some((k) => k.kind === opts.kind) ? opts.kind : DEFAULT_KIND[type];
  const id = createId();
  let node: IRNode = {
    id,
    type: kind,
    label: opts.label?.trim() || defaultLabel(type, kind),
    position: opts.position ?? { x: 0, y: 0 },
    data: {},
  };
  if (opts.description || opts.category || opts.date || opts.dateLabel) {
    node = withExtras(node, { description: opts.description, category: opts.category, date: opts.date, dateLabel: opts.dateLabel });
  }
  const anchor = opts.from ? doc.nodes.find((n) => n.id === opts.from) : undefined;

  if (isTreeType(type)) {
    const tree = mindTree(doc);
    const parentId = anchor?.id ?? tree.rootId;
    if (!parentId && doc.nodes.length === 0) {
      node = { ...node, type: "topic", label: opts.label?.trim() || defaultLabel(type, "topic") };
      return { doc: settle({ ...doc, nodes: [sized(doc, node)] }), id };
    }
    if (!parentId) return { doc, id: "" };
    const parentIsRoot = parentId === tree.rootId;
    // Mind-map branches are colour-coded by family; people on an org chart are not.
    if (type === "mindmap") node = withColor(node, parentIsRoot ? nextBranchColour(doc) : getColor(tree.byId.get(parentId)!));
    const edge: IREdge = { id: createId(), source: parentId, target: id, data: { directed: false } };
    const parent = tree.byId.get(parentId)!;
    const nodes = doc.nodes.map((n) => (n.id === parentId && getExtras(parent).collapsed ? withExtras(n, { collapsed: null }) : n));
    return { doc: settle({ ...doc, nodes: [...nodes, sized(doc, { ...node, type: "branch" })], edges: [...doc.edges, edge] }), id };
  }

  if (type === "timeline") {
    node = sized(doc, node);
    const nodes = [...doc.nodes];
    const key = sortKeyOf(opts.date);
    let at = nodes.length;
    const allDated = nodes.every((n) => sortKeyOf(getExtras(n).date) !== undefined);
    if (key !== undefined && allDated) {
      const i = nodes.findIndex((n) => sortKeyOf(getExtras(n).date)! > key);
      at = i === -1 ? nodes.length : i;
    } else if (anchor) {
      at = nodes.findIndex((n) => n.id === anchor.id) + 1;
    }
    nodes.splice(at, 0, node);
    return { doc: settle({ ...doc, nodes }), id };
  }

  // flowchart / conceptmap: free positioning near the anchor.
  node = sized(doc, node);
  if (!opts.position) {
    const size = node.size!;
    if (anchor) {
      const a = anchor.size ?? { width: 140, height: 44 };
      const vertical = doc.layout.direction === "TB" || doc.layout.direction === "BT";
      const siblings = doc.edges.filter((e) => e.source === anchor.id).length;
      node = {
        ...node,
        position: vertical
          ? { x: anchor.position.x + siblings * (size.width + 40), y: anchor.position.y + a.height + doc.layout.spacing.y }
          : { x: anchor.position.x + a.width + doc.layout.spacing.x, y: anchor.position.y + siblings * (size.height + 30) },
      };
    } else {
      const k = doc.nodes.length;
      const maxY = Math.max(0, ...doc.nodes.map((n) => n.position.y + (n.size?.height ?? 44)));
      node = { ...node, position: { x: (k % 4) * 40, y: doc.nodes.length ? maxY + 50 : 0 } };
    }
  }
  const lanes = readLanes(doc);
  if (lanes.length) {
    // A new step joins the lane of the step it follows, or the lane where it was dropped, or the first lane.
    let lane = anchor ? lanes[laneIndexOf(anchor, lanes)]! : lanes[0]!;
    const geo = laneGeometry(doc);
    if (!anchor && opts.position && geo) lane = lanes[laneAtCross(geo, geo.horizontal ? opts.position.y : opts.position.x)]!;
    node = withExtras(node, { lane });
  }
  const edges = anchor && !(type === "flowchart" && anchor.type === "end") ? [...doc.edges, { id: createId(), source: anchor.id, target: id } as IREdge] : doc.edges;
  return { doc: { ...doc, nodes: [...doc.nodes, node], edges }, id };
}

export function updateNode(
  doc: VisualisationIR,
  id: string,
  patch: { label?: string; kind?: string; color?: ColorKey } & { [K in keyof NodeExtras]?: NodeExtras[K] | null },
): VisualisationIR {
  const type = engine(doc);
  let changed = false;
  let relayout = false;
  const nodes = doc.nodes.map((n) => {
    if (n.id !== id) return n;
    let next = n;
    if (patch.label !== undefined && patch.label.trim() && patch.label.trim() !== n.label) {
      next = { ...next, label: patch.label.trim().slice(0, 500) };
      relayout = true;
    }
    if (patch.kind && type && patch.kind !== n.type && NODE_KINDS[type].some((k) => k.kind === patch.kind) && !isTreeType(type)) {
      next = { ...next, type: patch.kind };
      relayout = true;
    }
    if (patch.color && getColor(next) !== patch.color) next = withColor(next, patch.color);
    const { label: _l, kind: _k, color: _c, ...extras } = patch;
    void _l; void _k; void _c;
    if (Object.keys(extras).length) {
      const merged = withExtras(next, extras);
      if (JSON.stringify(merged.data) !== JSON.stringify(next.data)) {
        next = merged;
        if ("description" in extras || "date" in extras) relayout = true;
      }
    }
    if (next !== n) changed = true;
    return next.size && relayout ? sized(doc, next) : next;
  });
  if (!changed) return doc;
  let out: VisualisationIR = { ...doc, nodes };

  // Editing a timeline date keeps absolutely-dated timelines in date order.
  if (type === "timeline" && "date" in patch) out = sortTimeline(out);
  return settle(out);
}

function sortTimeline(doc: VisualisationIR): VisualisationIR {
  const keys = doc.nodes.map((n) => sortKeyOf(getExtras(n).date));
  if (keys.some((k) => k === undefined)) return doc;
  const order = doc.nodes.map((n, i) => ({ n, k: keys[i]!, i })).sort((a, b) => a.k - b.k || a.i - b.i);
  return { ...doc, nodes: order.map((o) => o.n) };
}

export function canDelete(doc: VisualisationIR, ids: readonly string[]): boolean {
  if (ids.length === 0) return false;
  if (isTreeType(doc.type)) {
    const root = mindTree(doc).rootId;
    return ids.some((i) => i !== root);
  }
  return true;
}

export function deleteNodes(doc: VisualisationIR, ids: readonly string[]): VisualisationIR {
  if (!canDelete(doc, ids)) return doc;
  const gone = new Set(ids);
  if (isTreeType(doc.type)) {
    const tree = mindTree(doc);
    gone.delete(tree.rootId ?? "");
    for (const id of [...gone]) for (const d of descendants(tree, id)) gone.add(d);
  }
  if (![...gone].some((id) => doc.nodes.some((n) => n.id === id))) return doc;

  let edges = doc.edges;
  if (doc.type === "flowchart") {
    // Removing a step in the middle of a path joins its neighbours instead of breaking the flow.
    const bridges: IREdge[] = [];
    for (const id of gone) {
      const ins = doc.edges.filter((e) => e.target === id && !gone.has(e.source));
      const outs = doc.edges.filter((e) => e.source === id && !gone.has(e.target));
      if (ins.length === 1 && outs.length === 1 && ins[0]!.source !== outs[0]!.target) {
        bridges.push({ id: createId(), source: ins[0]!.source, target: outs[0]!.target, ...((ins[0]!.label ?? outs[0]!.label) ? { label: ins[0]!.label ?? outs[0]!.label } : {}) });
      }
    }
    edges = [...doc.edges, ...bridges].filter((e) => !gone.has(e.source) && !gone.has(e.target));
    edges = edges.filter((e, i) => edges.findIndex((x) => x.source === e.source && x.target === e.target && x.label === e.label) === i);
  } else {
    edges = doc.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target));
  }
  return settle({ ...doc, nodes: doc.nodes.filter((n) => !gone.has(n.id)), edges });
}

export function connect(doc: VisualisationIR, source: string, target: string, label?: string): VisualisationIR {
  if (doc.type !== "flowchart" && doc.type !== "conceptmap") return doc;
  if (source === target) return doc;
  const ids = new Set(doc.nodes.map((n) => n.id));
  if (!ids.has(source) || !ids.has(target)) return doc;
  if (doc.edges.some((e) => e.source === source && e.target === target)) return doc;
  const edge: IREdge = { id: createId(), source, target, ...(label?.trim() ? { label: label.trim() } : {}) };
  return { ...doc, edges: [...doc.edges, edge] };
}

export function updateEdge(doc: VisualisationIR, id: string, patch: { label?: string | null; directed?: boolean }): VisualisationIR {
  let changed = false;
  const edges = doc.edges.map((e) => {
    if (e.id !== id) return e;
    let next = { ...e };
    if (patch.label !== undefined) {
      const v = patch.label?.trim();
      if (v) next = { ...next, label: v.slice(0, 500) };
      else delete next.label;
    }
    if (patch.directed !== undefined) {
      const data = { ...(next.data ?? {}) };
      if (patch.directed) delete data.directed;
      else data.directed = false;
      next = { ...next, data: Object.keys(data).length ? data : undefined };
    }
    if (JSON.stringify(next) !== JSON.stringify(e)) changed = true;
    return next;
  });
  return changed ? { ...doc, edges } : doc;
}

export function reverseEdge(doc: VisualisationIR, id: string): VisualisationIR {
  if (doc.type !== "flowchart" && doc.type !== "conceptmap") return doc;
  return { ...doc, edges: doc.edges.map((e) => (e.id === id ? { ...e, source: e.target, target: e.source } : e)) };
}

export function deleteEdges(doc: VisualisationIR, ids: readonly string[]): VisualisationIR {
  if (doc.type !== "flowchart" && doc.type !== "conceptmap") return doc;
  const gone = new Set(ids);
  const edges = doc.edges.filter((e) => !gone.has(e.id));
  return edges.length === doc.edges.length ? doc : { ...doc, edges };
}

export function moveNodes(doc: VisualisationIR, positions: Readonly<Record<string, { x: number; y: number }>>): VisualisationIR {
  if (AUTO[doc.type]) return doc; // positions are derived for these types
  const geo = laneGeometry(doc);
  const lanes = readLanes(doc);
  let changed = false;
  const nodes = doc.nodes.map((n) => {
    const p = positions[n.id];
    if (!p || (p.x === n.position.x && p.y === n.position.y)) return n;
    changed = true;
    let next: IRNode = { ...n, position: { x: Math.round(p.x), y: Math.round(p.y) } };
    if (geo) {
      // With swimlanes, where a step is dropped decides its lane; its cross-axis position is then derived from the lane.
      const size = n.size ?? { width: 140, height: 44 };
      const centre = geo.horizontal ? p.y + size.height / 2 : p.x + size.width / 2;
      const lane = lanes[laneAtCross(geo, centre)]!;
      if (laneIndexOf(n, lanes) !== lanes.indexOf(lane) || getExtras(n).lane !== lane) next = withExtras(next, { lane });
    }
    return next;
  });
  return changed ? { ...doc, nodes } : doc;
}

export function setStyle(doc: VisualisationIR, ids: readonly string[], color: ColorKey): VisualisationIR {
  const set = new Set(ids);
  let changed = false;
  const nodes = doc.nodes.map((n) => {
    if (!set.has(n.id) || getColor(n) === color) return n;
    changed = true;
    return withColor(n, color);
  });
  return changed ? { ...doc, nodes } : doc;
}

export function duplicateNodes(doc: VisualisationIR, ids: readonly string[]): AddResult & { ids: string[] } {
  const type = engine(doc);
  const chosen = new Set(ids);
  if (!type || chosen.size === 0) return { doc, id: "", ids: [] };

  if (isTreeType(type)) {
    const tree = mindTree(doc);
    const newIds: string[] = [];
    let out = doc;
    for (const id of ids) {
      if (id === tree.rootId) continue;
      const parent = tree.parent.get(id);
      if (!parent) continue;
      const subtree = [id, ...descendants(tree, id).reverse().reverse()];
      const sub = new Set(subtree);
      const map = new Map(subtree.map((s) => [s, createId()]));
      const clones = doc.nodes.filter((n) => sub.has(n.id)).map((n) => ({ ...structuredClone(n), id: map.get(n.id)! }));
      const edges = doc.edges.filter((e) => sub.has(e.source) && sub.has(e.target)).map((e) => ({ ...structuredClone(e), id: createId(), source: map.get(e.source)!, target: map.get(e.target)! }));
      const link: IREdge = { id: createId(), source: parent, target: map.get(id)!, data: { directed: false } };
      // Insert the copy right after the original among its siblings.
      const siblings = out.edges.filter((e) => e.source === parent);
      const idx = out.edges.indexOf(siblings.find((e) => e.target === id)!);
      const outEdges = [...out.edges];
      outEdges.splice(idx + 1, 0, link);
      out = { ...out, nodes: [...out.nodes, ...clones], edges: [...outEdges, ...edges] };
      newIds.push(map.get(id)!);
    }
    return newIds.length ? { doc: settle(out), id: newIds[0]!, ids: newIds } : { doc, id: "", ids: [] };
  }

  const picked = doc.nodes.filter((n) => chosen.has(n.id));
  if (picked.length === 0) return { doc, id: "", ids: [] };
  const map = new Map(picked.map((n) => [n.id, createId()]));
  const clones = picked.map((n) => ({ ...structuredClone(n), id: map.get(n.id)!, position: { x: n.position.x + 36, y: n.position.y + 36 } }));

  if (type === "timeline") {
    const nodes = [...doc.nodes];
    for (const c of clones) {
      const origin = picked.find((p) => map.get(p.id) === c.id)!;
      nodes.splice(nodes.findIndex((n) => n.id === origin.id) + 1, 0, c);
    }
    return { doc: settle({ ...doc, nodes }), id: clones[0]!.id, ids: clones.map((c) => c.id) };
  }
  const edges = doc.edges.filter((e) => map.has(e.source) && map.has(e.target)).map((e) => ({ ...structuredClone(e), id: createId(), source: map.get(e.source)!, target: map.get(e.target)! }));
  return { doc: { ...doc, nodes: [...doc.nodes, ...clones], edges: [...doc.edges, ...edges] }, id: clones[0]!.id, ids: clones.map((c) => c.id) };
}

// ── Mind map hierarchy ──────────────────────────────────────────────────────

/** Valid new parents for a node: anything except itself, its descendants and (for the root) everything. */
export function reparentTargets(doc: VisualisationIR, id: string): IRNode[] {
  if (!isTreeType(doc.type)) return [];
  const tree = mindTree(doc);
  if (id === tree.rootId) return [];
  const blocked = new Set([id, ...descendants(tree, id), tree.parent.get(id) ?? ""]);
  return doc.nodes.filter((n) => !blocked.has(n.id));
}

function recolourSubtree(doc: VisualisationIR, rootOfBranch: string, color: ColorKey): VisualisationIR {
  const tree = mindTree(doc);
  const ids = new Set([rootOfBranch, ...descendants(tree, rootOfBranch)]);
  return { ...doc, nodes: doc.nodes.map((n) => (ids.has(n.id) ? withColor(n, color) : n)) };
}

export function reparent(doc: VisualisationIR, id: string, newParentId: string): VisualisationIR {
  if (!isTreeType(doc.type)) return doc;
  const tree = mindTree(doc);
  if (id === tree.rootId || !tree.byId.has(newParentId)) return doc;
  if (id === newParentId || descendants(tree, id).includes(newParentId)) return doc;
  const edges = doc.edges.filter((e) => e.target !== id);
  edges.push({ id: createId(), source: newParentId, target: id, data: { directed: false } });
  let out: VisualisationIR = { ...doc, edges };
  if (newParentId === tree.rootId) out = recolourSubtree(out, id, nextBranchColour({ ...doc, edges: doc.edges.filter((e) => e.target !== id) }));
  else out = recolourSubtree(out, id, getColor(tree.byId.get(newParentId)!));
  const expand = out.nodes.map((n) => (n.id === newParentId && getExtras(n).collapsed ? withExtras(n, { collapsed: null }) : n));
  return settle({ ...out, nodes: expand });
}

export function moveSibling(doc: VisualisationIR, id: string, delta: -1 | 1): VisualisationIR {
  if (!isTreeType(doc.type)) return doc;
  const tree = mindTree(doc);
  const parent = tree.parent.get(id);
  if (!parent) return doc;
  const sibs = tree.children.get(parent)!;
  const i = sibs.indexOf(id);
  const j = i + delta;
  if (j < 0 || j >= sibs.length) return doc;
  const a = doc.edges.findIndex((e) => e.source === parent && e.target === sibs[i]);
  const b = doc.edges.findIndex((e) => e.source === parent && e.target === sibs[j]);
  const edges = [...doc.edges];
  [edges[a], edges[b]] = [edges[b]!, edges[a]!];
  return settle({ ...doc, edges });
}

export function toggleCollapse(doc: VisualisationIR, id: string): VisualisationIR {
  if (!isTreeType(doc.type)) return doc;
  const tree = mindTree(doc);
  if (!(tree.children.get(id)?.length)) return doc;
  return settle({ ...doc, nodes: doc.nodes.map((n) => (n.id === id ? withExtras(n, { collapsed: getExtras(n).collapsed ? null : true }) : n)) });
}

export function setAllCollapsed(doc: VisualisationIR, collapsed: boolean): VisualisationIR {
  if (!isTreeType(doc.type)) return doc;
  const tree = mindTree(doc);
  return settle({
    ...doc,
    nodes: doc.nodes.map((n) => (n.id !== tree.rootId && (tree.children.get(n.id)?.length ?? 0) > 0 ? withExtras(n, { collapsed: collapsed ? true : null }) : n)),
  });
}

/** Ids hidden because an ancestor is collapsed. */
export function hiddenNodeIds(doc: VisualisationIR): Set<string> {
  if (!isTreeType(doc.type)) return new Set();
  const tree = mindTree(doc);
  const hidden = new Set<string>();
  const walk = (id: string, hide: boolean) => {
    for (const c of tree.children.get(id) ?? []) {
      if (hide) hidden.add(c);
      walk(c, hide || getExtras(tree.byId.get(c)!).collapsed === true);
    }
  };
  if (tree.rootId) walk(tree.rootId, getExtras(tree.byId.get(tree.rootId)!).collapsed === true);
  return hidden;
}

export function mindDepth(doc: VisualisationIR, id: string): number {
  return depthOf(mindTree(doc), id);
}

// ── Timeline order ──────────────────────────────────────────────────────────

export function canMoveEvent(doc: VisualisationIR, id: string, delta: -1 | 1): { ok: boolean; reason?: string } {
  if (doc.type !== "timeline") return { ok: false };
  const i = doc.nodes.findIndex((n) => n.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= doc.nodes.length) return { ok: false };
  const a = sortKeyOf(getExtras(doc.nodes[i]!).date);
  const b = sortKeyOf(getExtras(doc.nodes[j]!).date);
  if (a !== undefined && b !== undefined && a !== b) {
    return { ok: false, reason: "These events have different dates. Change the date to move this event." };
  }
  return { ok: true };
}

export function moveEvent(doc: VisualisationIR, id: string, delta: -1 | 1): VisualisationIR {
  if (!canMoveEvent(doc, id, delta).ok) return doc;
  const nodes = [...doc.nodes];
  const i = nodes.findIndex((n) => n.id === id);
  [nodes[i], nodes[i + delta]] = [nodes[i + delta]!, nodes[i]!];
  return settle({ ...doc, nodes });
}

// ── Layout ──────────────────────────────────────────────────────────────────

export function setLayout(doc: VisualisationIR, patch: Partial<Pick<VisualisationIR["layout"], "algorithm" | "direction">>): VisualisationIR {
  const layout = { ...doc.layout, ...patch };
  if (layout.algorithm === doc.layout.algorithm && layout.direction === doc.layout.direction) return doc;
  return applyLayout({ ...doc, layout });
}

/** Recompute every position from the current structure (discards manual positioning). */
export function resetLayout(doc: VisualisationIR): VisualisationIR {
  return applyLayout(doc);
}
