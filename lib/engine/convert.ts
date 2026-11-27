import { createId } from "@/lib/utils/id";
import { defaultLayoutFor } from "@/lib/visualisation/defaults";
import type { IREdge, IRNode, VisualisationIR, VisualisationType } from "@/types/visualisation";
import { sortKeyOf } from "./interpret/dates";
import { applyLayout } from "./layout";
import { mindTree } from "./mindmap-tree";
import { CATEGORY_CYCLE, DEFAULT_KIND, NODE_KINDS, getExtras, isEngineType, withColor, withExtras, type EngineType } from "./semantics";

export interface Change {
  text: string;
  /** "loss" means information stops being shown or is dropped; "info" is a harmless change of form. */
  severity: "info" | "loss";
}

export interface ConversionPlan {
  from: VisualisationType;
  to: EngineType;
  /** The converted document, ready to apply. Absent when blocked. */
  result?: VisualisationIR;
  changes: Change[];
  blocked?: string;
  /** True when nothing is lost (only the form changes). */
  lossless: boolean;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const arrow = (a: string, b: string) => `“${a}” → “${b}”`;

/** Remember a node's previous kind so converting back restores its shape exactly. */
function reKind(n: IRNode, to: EngineType, from: VisualisationType): IRNode {
  const prev = typeof n.data.prevKind === "string" && typeof n.data.prevFor === "string" && n.data.prevFor === to ? n.data.prevKind : undefined;
  const kind = prev && NODE_KINDS[to].some((k) => k.kind === prev) ? prev : DEFAULT_KIND[to];
  const data = { ...n.data };
  if (n.type !== kind) {
    data.prevKind = n.type;
    data.prevFor = from;
  }
  return { ...n, type: kind, data };
}

/** Breadth-first order starting from sources (or the first node), then any stragglers. */
function flowOrder(nodes: readonly IRNode[], edges: readonly IREdge[]): IRNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const hasIn = new Set(edges.map((e) => e.target));
  const starts = nodes.filter((n) => !hasIn.has(n.id));
  const seen = new Set<string>();
  const out: IRNode[] = [];
  const queue = [...(starts.length ? starts : nodes.slice(0, 1))];
  const push = (n: IRNode) => {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      out.push(n);
      queue.push(n);
    }
  };
  queue.splice(0).forEach(push);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) if (e.source === cur.id && byId.has(e.target)) push(byId.get(e.target)!);
  }
  for (const n of nodes) push(n);
  return out;
}

function treeFromGraph(doc: VisualisationIR): { nodes: IRNode[]; edges: IREdge[]; lostEdges: IREdge[]; newRoot: boolean } {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const out = new Map<string, IREdge[]>(doc.nodes.map((n) => [n.id, []]));
  for (const e of doc.edges) if (byId.has(e.source) && byId.has(e.target)) out.get(e.source)!.push(e);
  const hasIn = new Set(doc.edges.map((e) => e.target));
  const sources = doc.nodes.filter((n) => !hasIn.has(n.id));
  const order = [...sources.filter((n) => n.type === "start"), ...sources.filter((n) => n.type !== "start")];
  const visited = new Set<string>();
  const kept: IREdge[] = [];
  const roots: string[] = [];
  const grow = (rootId: string) => {
    roots.push(rootId);
    visited.add(rootId);
    const q = [rootId];
    while (q.length) {
      const cur = q.shift()!;
      for (const e of out.get(cur)!) {
        if (!visited.has(e.target)) {
          visited.add(e.target);
          kept.push(e);
          q.push(e.target);
        }
      }
    }
  };
  for (const s of order) if (!visited.has(s.id)) grow(s.id);
  for (const n of doc.nodes) if (!visited.has(n.id)) grow(n.id); // pure cycles
  const lost = doc.edges.filter((e) => !kept.includes(e));
  return { nodes: [...doc.nodes], edges: kept, lostEdges: lost, newRoot: roots.length > 1 ? true : false };
}

function finish(doc: VisualisationIR, to: EngineType, nodes: IRNode[], edges: IREdge[], layoutHint?: Partial<VisualisationIR["layout"]>): VisualisationIR {
  const layout = { ...defaultLayoutFor(to), ...layoutHint };
  return applyLayout({ ...doc, type: to, nodes, edges, layout, viewport: { x: 0, y: 0, zoom: 1 } });
}

function colourBranches(nodes: IRNode[], edges: IREdge[], rootId: string): IRNode[] {
  const kids = new Map<string, string[]>();
  for (const e of edges) kids.set(e.source, [...(kids.get(e.source) ?? []), e.target]);
  const colour = new Map<string, (typeof CATEGORY_CYCLE)[number]>();
  (kids.get(rootId) ?? []).forEach((b, i) => {
    const stack = [b];
    while (stack.length) {
      const id = stack.pop()!;
      colour.set(id, CATEGORY_CYCLE[i % CATEGORY_CYCLE.length]!);
      stack.push(...(kids.get(id) ?? []));
    }
  });
  return nodes.map((n) => (colour.has(n.id) ? withColor(n, colour.get(n.id)!) : n));
}

/**
 * Work out what switching `doc` to `to` would do, without doing it. The result
 * is applied only after the user has seen `changes`. Conversion is always one
 * undoable step, and kinds/relations are remembered so switching back is exact.
 */
export function planConversion(doc: VisualisationIR, to: EngineType): ConversionPlan {
  const from = doc.type;
  const base: Omit<ConversionPlan, "lossless"> = { from, to, changes: [] };
  const done = (changes: Change[], result: VisualisationIR): ConversionPlan => ({ ...base, changes, result, lossless: changes.every((c) => c.severity === "info") });

  if (!isEngineType(from)) {
    return { ...base, blocked: from === "chart" ? "A chart is built from data, not from nodes, so it cannot become a diagram." : "This type cannot be converted.", lossless: false };
  }
  if (from === to) return { ...base, changes: [], result: doc, lossless: true };
  if (doc.nodes.length === 0) return done([{ text: "It is empty, so only the type changes.", severity: "info" }], finish(doc, to, [], []));

  const changes: Change[] = [];
  const labelOf = (id: string) => doc.nodes.find((n) => n.id === id)?.label ?? id;

  // ── graph ⇄ graph (flowchart ⇄ concept map)
  if ((from === "flowchart" && to === "conceptmap") || (from === "conceptmap" && to === "flowchart")) {
    const restored = doc.nodes.filter((n) => typeof n.data.prevKind === "string" && n.data.prevFor === to).length;
    const nodes = doc.nodes.map((n) => reKind(n, to, from));
    if (from === "flowchart") {
      const shaped = doc.nodes.filter((n) => n.type !== "process").length;
      if (shaped) changes.push({ text: `${plural(shaped, "Start, End, Decision or Input/Output shape")} become plain concepts. They are remembered and restored if you switch back.`, severity: "info" });
      changes.push({ text: "Connections and their labels are kept.", severity: "info" });
    } else {
      const undirected = doc.edges.filter((e) => e.data?.directed === false).length;
      changes.push({ text: restored ? `${plural(restored, "concept")} get their original flowchart shapes back.` : "Every concept becomes a process step. Add Start, End and Decision shapes if you need them.", severity: "info" });
      if (undirected) changes.push({ text: `${plural(undirected, "plain line")} become arrows, because flowchart connections always have a direction.`, severity: "info" });
    }
    const edges = from === "conceptmap" ? doc.edges.map((e) => (e.data?.directed === false ? { ...e, data: undefined } : e)) : doc.edges;
    return done(changes, finish(doc, to, nodes, edges, { direction: doc.layout.direction === "LR" ? "LR" : "TB", algorithm: to === "conceptmap" && doc.edges.length ? "layered" : "layered" }));
  }

  // ── anything → mind map
  if (to === "mindmap") {
    let nodes: IRNode[];
    let edges: IREdge[];
    let rootId: string;
    if (from === "timeline") {
      const root: IRNode = { id: createId(), type: "topic", label: doc.title, position: { x: 0, y: 0 }, data: { structural: true } };
      nodes = [root, ...doc.nodes.map((n) => reKind(n, to, from))];
      edges = doc.nodes.map((n) => ({ id: createId(), source: root.id, target: n.id, data: { directed: false } }));
      rootId = root.id;
      changes.push({ text: `A central topic named “${doc.title}” is added, with each event as a branch in time order.`, severity: "info" });
      changes.push({ text: "Dates are kept with each event but not shown on a mind map.", severity: "loss" });
    } else {
      const t = treeFromGraph(doc);
      const hasIn = new Set(doc.edges.map((e) => e.target));
      const sourcesList = doc.nodes.filter((n) => !hasIn.has(n.id));
      const treeRoots = t.nodes.filter((n) => !t.edges.some((e) => e.target === n.id));
      if (treeRoots.length === 1) {
        rootId = treeRoots[0]!.id;
        nodes = doc.nodes.map((n) => (n.id === rootId ? { ...reKind(n, to, from), type: "topic" } : reKind(n, to, from)));
        edges = t.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, data: { directed: false } }));
        changes.push({ text: `“${labelOf(rootId)}” becomes the central topic.`, severity: "info" });
      } else {
        const root: IRNode = { id: createId(), type: "topic", label: doc.title, position: { x: 0, y: 0 }, data: { structural: true } };
        rootId = root.id;
        nodes = [root, ...doc.nodes.map((n) => reKind(n, to, from))];
        edges = [...treeRoots.map((r) => ({ id: createId(), source: root.id, target: r.id, data: { directed: false } })), ...t.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, data: { directed: false } }))];
        changes.push({ text: `Your ${plural(treeRoots.length, "separate group")} are not connected, so a central topic named “${doc.title}” is added and each group becomes a branch.`, severity: "info" });
      }
      void sourcesList;
      // Edge labels live on the child so they survive and can be restored.
      const labelFor = new Map(t.edges.filter((e) => e.label).map((e) => [e.target, e.label!]));
      nodes = nodes.map((n) => (labelFor.has(n.id) ? { ...n, data: { ...n.data, relation: labelFor.get(n.id)! } } : n));
      if (labelFor.size) changes.push({ text: `${plural(labelFor.size, "connection label")} are kept with the branch but not shown.`, severity: "loss" });
      if (t.lostEdges.length) {
        const sample = t.lostEdges.slice(0, 3).map((e) => arrow(labelOf(e.source), labelOf(e.target))).join(", ");
        changes.push({ text: `${plural(t.lostEdges.length, "connection")} do not fit a tree and are removed: ${sample}${t.lostEdges.length > 3 ? ", …" : ""}.`, severity: "loss" });
      }
      if (from === "flowchart") changes.push({ text: "Decision branches and their Yes/No meaning are flattened into a hierarchy.", severity: "loss" });
    }
    return done(changes, finish(doc, to, colourBranches(nodes, edges, rootId), edges));
  }

  // ── mind map → graph
  if (from === "mindmap") {
    const tree = mindTree(doc);
    const nodes = doc.nodes.map((n) => {
      const k = reKind(n, to, from);
      const rel = typeof n.data.relation === "string" ? n.data.relation : undefined;
      void rel;
      return k;
    });
    const edges: IREdge[] = doc.edges.map((e) => {
      const rel = tree.byId.get(e.target)?.data.relation;
      return { id: e.id, source: e.source, target: e.target, ...(typeof rel === "string" ? { label: rel } : {}) };
    });
    const labelled = edges.filter((e) => e.label).length;
    changes.push({ text: `Branches become ${to === "flowchart" ? "steps joined by arrows" : "concepts joined by arrows"}, pointing from parent to child.`, severity: "info" });
    if (labelled) changes.push({ text: `${plural(labelled, "connection label")} saved from an earlier conversion are restored.`, severity: "info" });
    if (to === "flowchart") changes.push({ text: "Every branch becomes a process step. Mark Start, End and Decision shapes yourself if needed.", severity: "info" });
    const hidden = doc.nodes.filter((n) => getExtras(n).collapsed).length;
    if (hidden) changes.push({ text: `${plural(hidden, "collapsed branch")} are expanded.`, severity: "info" });
    const cleaned = nodes.map((n) => withExtras(n, { collapsed: null }));
    return done(changes, finish(doc, to, cleaned, edges, to === "flowchart" ? { direction: "TB" } : { algorithm: "layered", direction: "TB" }));
  }

  // ── graph → timeline
  if (to === "timeline" && from !== "timeline") {
    const dated = doc.nodes.filter((n) => sortKeyOf(getExtras(n).date) !== undefined);
    const allDated = dated.length === doc.nodes.length;
    const ordered = allDated
      ? [...doc.nodes].sort((a, b) => sortKeyOf(getExtras(a).date)! - sortKeyOf(getExtras(b).date)!)
      : flowOrder(doc.nodes, doc.edges);
    const nodes = ordered.map((n) => reKind(withExtras(n, { collapsed: null }), to, from));
    changes.push({ text: allDated ? "Events are placed in date order." : `Events follow the order of your ${from === "flowchart" ? "flow" : "connections"}, because not every item has a date.`, severity: "info" });
    if (!allDated) changes.push({ text: `${plural(doc.nodes.length - dated.length, "item")} have no date. Add dates in the inspector to place them on a calendar.`, severity: "info" });
    if (doc.edges.length) changes.push({ text: `${plural(doc.edges.length, "connection")} are removed; a timeline shows order, not links.`, severity: "loss" });
    return done(changes, finish(doc, to, nodes, []));
  }

  // ── timeline → graph
  if (from === "timeline") {
    const nodes = doc.nodes.map((n) => reKind(n, to, from));
    let edges: IREdge[] = [];
    if (to === "flowchart") {
      edges = nodes.slice(1).map((n, i) => ({ id: createId(), source: nodes[i]!.id, target: n.id }));
      changes.push({ text: `Events become steps joined in time order. These ${plural(edges.length, "connection")} are new: they show sequence, not cause.`, severity: "info" });
    } else {
      changes.push({ text: "Events become concepts with no connections. A timeline does not say how events relate, so none are invented.", severity: "info" });
    }
    changes.push({ text: "Dates are kept with each item but not shown here.", severity: "loss" });
    return done(changes, finish(doc, to, nodes, edges, to === "flowchart" ? { direction: "TB" } : { algorithm: edges.length ? "layered" : "force", direction: "TB" }));
  }

  return { ...base, blocked: "This conversion is not supported.", lossless: false };
}
