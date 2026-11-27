import type { LNode, Pos } from "./layered";

/**
 * Top-down org chart layout. Each person is centred above their reports, and
 * every subtree takes at least as much width as the people in it, so nothing
 * overlaps. Collapsed people lay out as leaves and hide everyone beneath them.
 * Deterministic.
 */
export function orgLayout(
  nodes: readonly LNode[],
  children: ReadonlyMap<string, string[]>,
  rootId: string,
  collapsed: ReadonlySet<string>,
  opts: { gapX: number; gapY: number },
): { positions: Map<string, Pos>; hidden: Set<string> } {
  const size = new Map(nodes.map((n) => [n.id, n]));
  const hidden = new Set<string>();
  const kids = (id: string): string[] => (collapsed.has(id) ? [] : (children.get(id) ?? []).filter((c) => size.has(c)));

  const markHidden = (id: string, hide: boolean) => {
    for (const c of children.get(id) ?? []) {
      if (hide) hidden.add(c);
      markHidden(c, hide || collapsed.has(c));
    }
  };
  markHidden(rootId, collapsed.has(rootId));

  const widthCache = new Map<string, number>();
  const subtreeWidth = (id: string): number => {
    const hit = widthCache.get(id);
    if (hit !== undefined) return hit;
    const ks = kids(id);
    const own = size.get(id)!.width;
    const w = ks.length ? Math.max(own, ks.reduce((a, k) => a + subtreeWidth(k), 0) + (ks.length - 1) * opts.gapX) : own;
    widthCache.set(id, w);
    return w;
  };

  const positions = new Map<string, Pos>();
  if (!size.has(rootId)) return { positions, hidden };

  // Rows are as tall as their tallest person, so a row of cards lines up.
  const rowHeight = new Map<number, number>();
  const measure = (id: string, depth: number) => {
    rowHeight.set(depth, Math.max(rowHeight.get(depth) ?? 0, size.get(id)!.height));
    for (const k of kids(id)) measure(k, depth + 1);
  };
  measure(rootId, 0);
  const rowTop = new Map<number, number>();
  let y = 0;
  for (let d = 0; rowHeight.has(d); d++) {
    rowTop.set(d, y);
    y += rowHeight.get(d)! + opts.gapY;
  }

  const place = (id: string, left: number, depth: number) => {
    const n = size.get(id)!;
    const block = subtreeWidth(id);
    positions.set(id, { x: left + (block - n.width) / 2, y: rowTop.get(depth)! });
    const ks = kids(id);
    const used = ks.reduce((a, k) => a + subtreeWidth(k), 0) + Math.max(0, ks.length - 1) * opts.gapX;
    let cursor = left + (block - used) / 2;
    for (const k of ks) {
      place(k, cursor, depth + 1);
      cursor += subtreeWidth(k) + opts.gapX;
    }
  };
  place(rootId, -subtreeWidth(rootId) / 2, 0);
  return { positions, hidden };
}
