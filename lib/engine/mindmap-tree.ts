import type { IRNode, VisualisationIR } from "@/types/visualisation";

export interface MindTree {
  rootId: string | undefined;
  children: Map<string, string[]>;
  parent: Map<string, string>;
  byId: Map<string, IRNode>;
}

/**
 * A mind map's hierarchy is its edges (source = parent, target = child, in
 * sibling order). The root is the "topic" node, or failing that the first node
 * without a parent.
 */
export function mindTree(doc: Pick<VisualisationIR, "nodes" | "edges">): MindTree {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>(doc.nodes.map((n) => [n.id, []]));
  const parent = new Map<string, string>();
  for (const e of doc.edges) {
    if (!byId.has(e.source) || !byId.has(e.target) || parent.has(e.target)) continue;
    children.get(e.source)!.push(e.target);
    parent.set(e.target, e.source);
  }
  const rootId = doc.nodes.find((n) => n.type === "topic" && !parent.has(n.id))?.id ?? doc.nodes.find((n) => !parent.has(n.id))?.id;
  return { rootId, children, parent, byId };
}

export function descendants(tree: Pick<MindTree, "children">, id: string): string[] {
  const out: string[] = [];
  const stack = [...(tree.children.get(id) ?? [])];
  while (stack.length) {
    const n = stack.pop()!;
    out.push(n);
    stack.push(...(tree.children.get(n) ?? []));
  }
  return out;
}

export function depthOf(tree: Pick<MindTree, "parent">, id: string): number {
  let d = 0;
  for (let p = tree.parent.get(id); p; p = tree.parent.get(p)) d++;
  return d;
}
