import type { LNode, Pos } from "./layered";

/**
 * Balanced two-sided mind-map layout. The root sits in the middle; its
 * children alternate sides to balance leaf counts; each subtree is stacked by
 * leaf height. Collapsed nodes lay out as leaves and hide their descendants.
 */
export function treeLayout(
  nodes: readonly LNode[],
  children: ReadonlyMap<string, string[]>,
  rootId: string,
  collapsed: ReadonlySet<string>,
  opts: { gapX: number; gapY: number },
): { positions: Map<string, Pos>; hidden: Set<string> } {
  const size = new Map(nodes.map((n) => [n.id, n]));
  const hidden = new Set<string>();
  const kids = (id: string): string[] => (collapsed.has(id) ? [] : (children.get(id) ?? []).filter((c) => size.has(c)));

  // Mark descendants of collapsed nodes as hidden.
  const markHidden = (id: string, hide: boolean) => {
    for (const c of children.get(id) ?? []) {
      if (hide) hidden.add(c);
      markHidden(c, hide || collapsed.has(c));
    }
  };
  markHidden(rootId, collapsed.has(rootId));

  const heightCache = new Map<string, number>();
  const subtreeHeight = (id: string): number => {
    if (heightCache.has(id)) return heightCache.get(id)!;
    const ks = kids(id);
    const own = size.get(id)!.height;
    const h = ks.length ? Math.max(own, ks.reduce((a, k) => a + subtreeHeight(k), 0) + (ks.length - 1) * opts.gapY) : own;
    heightCache.set(id, h);
    return h;
  };

  const positions = new Map<string, Pos>();
  const root = size.get(rootId);
  if (!root) return { positions, hidden };
  positions.set(rootId, { x: 0, y: -root.height / 2 });

  // Balance sides by subtree height (greedy, deterministic).
  const left: string[] = [];
  const right: string[] = [];
  let lh = 0;
  let rh = 0;
  for (const c of kids(rootId)) {
    if (rh <= lh) {
      right.push(c);
      rh += subtreeHeight(c);
    } else {
      left.push(c);
      lh += subtreeHeight(c);
    }
  }

  const place = (id: string, parentX: number, parentW: number, top: number, dir: 1 | -1) => {
    const n = size.get(id)!;
    const block = subtreeHeight(id);
    const x = dir === 1 ? parentX + parentW + opts.gapX : parentX - opts.gapX - n.width;
    positions.set(id, { x, y: top + (block - n.height) / 2 });
    let cursor = top;
    for (const k of kids(id)) {
      place(k, x, n.width, cursor, dir);
      cursor += subtreeHeight(k) + opts.gapY;
    }
  };

  for (const [side, dir] of [[right, 1], [left, -1]] as [string[], 1 | -1][]) {
    const total = side.reduce((a, c) => a + subtreeHeight(c), 0) + Math.max(0, side.length - 1) * opts.gapY;
    let cursor = -total / 2;
    for (const c of side) {
      place(c, 0, root.width, cursor, dir);
      cursor += subtreeHeight(c) + opts.gapY;
    }
  }
  return { positions, hidden };
}
