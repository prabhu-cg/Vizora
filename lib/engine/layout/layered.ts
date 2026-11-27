export interface LNode {
  id: string;
  width: number;
  height: number;
}
export interface LEdge {
  source: string;
  target: string;
}
export type Pos = { x: number; y: number };

/**
 * Layered (Sugiyama-style) layout: break cycles, assign layers by longest
 * path, order each layer by barycenter sweeps, then place on a grid. Output is
 * deterministic for the same input order.
 */
export function layeredLayout(
  nodes: readonly LNode[],
  edges: readonly LEdge[],
  opts: { direction: "TB" | "BT" | "LR" | "RL"; gapX: number; gapY: number },
): Map<string, Pos> {
  const ids = nodes.map((n) => n.id);
  const known = new Set(ids);
  const out = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const e of edges) if (known.has(e.source) && known.has(e.target) && e.source !== e.target) out.get(e.source)!.push(e.target);

  // 1. Cycle breaking: depth-first from nodes in input order; edges into the active stack are reversed.
  const state = new Map<string, 0 | 1 | 2>();
  const dag = new Map<string, Set<string>>(ids.map((i) => [i, new Set()]));
  const visit = (start: string) => {
    const stack: { id: string; i: number }[] = [{ id: start, i: 0 }];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const targets = out.get(top.id)!;
      if (top.i >= targets.length) {
        state.set(top.id, 2);
        stack.pop();
        continue;
      }
      const t = targets[top.i++]!;
      const s = state.get(t) ?? 0;
      if (s === 1) dag.get(t)!.add(top.id); // back edge, reversed
      else {
        dag.get(top.id)!.add(t);
        if (s === 0) {
          state.set(t, 1);
          stack.push({ id: t, i: 0 });
        }
      }
    }
  };
  // Start from nodes with no incoming edges first so sources lead.
  const hasIn = new Set<string>();
  for (const [, ts] of out) for (const t of ts) hasIn.add(t);
  for (const id of ids.filter((i) => !hasIn.has(i))) if (!state.has(id)) visit(id);
  for (const id of ids) if (!state.has(id)) visit(id);

  // 2. Longest-path layering over the DAG.
  const indeg = new Map<string, number>(ids.map((i) => [i, 0]));
  for (const [, ts] of dag) for (const t of ts) indeg.set(t, indeg.get(t)! + 1);
  const layer = new Map<string, number>(ids.map((i) => [i, 0]));
  const queue = ids.filter((i) => indeg.get(i) === 0);
  while (queue.length) {
    const n = queue.shift()!;
    for (const t of dag.get(n)!) {
      layer.set(t, Math.max(layer.get(t)!, layer.get(n)! + 1));
      indeg.set(t, indeg.get(t)! - 1);
      if (indeg.get(t) === 0) queue.push(t);
    }
  }
  const maxLayer = Math.max(0, ...layer.values());
  const layers: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const id of ids) layers[layer.get(id)!]!.push(id);

  // 3. Barycenter ordering.
  const preds = new Map<string, string[]>(ids.map((i) => [i, []]));
  const succs = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const [s, ts] of dag) for (const t of ts) {
    preds.get(t)!.push(s);
    succs.get(s)!.push(t);
  }
  const orderIndex = new Map<string, number>();
  const refresh = () => layers.forEach((l) => l.forEach((id, i) => orderIndex.set(id, i)));
  refresh();
  const sweep = (down: boolean) => {
    const seq = down ? layers.slice(1) : layers.slice(0, -1).reverse();
    for (const l of seq) {
      const bary = new Map<string, number>();
      for (const id of l) {
        const neighbours = (down ? preds : succs).get(id)!;
        bary.set(id, neighbours.length ? neighbours.reduce((a, n) => a + orderIndex.get(n)!, 0) / neighbours.length : orderIndex.get(id)!);
      }
      l.sort((a, b) => bary.get(a)! - bary.get(b)! || orderIndex.get(a)! - orderIndex.get(b)!);
      l.forEach((id, i) => orderIndex.set(id, i));
    }
  };
  for (let i = 0; i < 4; i++) {
    sweep(true);
    sweep(false);
  }

  // 4. Coordinates. "Across" is within a layer, "along" is between layers.
  const vertical = opts.direction === "TB" || opts.direction === "BT";
  const size = new Map(nodes.map((n) => [n.id, n]));
  const across = (id: string) => (vertical ? size.get(id)!.width : size.get(id)!.height);
  const along = (id: string) => (vertical ? size.get(id)!.height : size.get(id)!.width);
  const gapAcross = vertical ? opts.gapX : opts.gapY;
  const gapAlong = vertical ? opts.gapY : opts.gapX;

  const extent = layers.map((l) => l.reduce((a, id) => a + across(id), 0) + Math.max(0, l.length - 1) * gapAcross);
  const widest = Math.max(0, ...extent);
  const result = new Map<string, Pos>();
  let cursorAlong = 0;
  layers.forEach((l, li) => {
    let a = (widest - extent[li]!) / 2;
    const thick = Math.max(0, ...l.map(along));
    for (const id of l) {
      const alongPos = cursorAlong + (thick - along(id)) / 2;
      const acrossPos = a;
      result.set(id, vertical ? { x: acrossPos, y: alongPos } : { x: alongPos, y: acrossPos });
      a += across(id) + gapAcross;
    }
    cursorAlong += thick + gapAlong;
  });

  if (opts.direction === "BT" || opts.direction === "RL") {
    const total = cursorAlong - gapAlong;
    for (const [id, p] of result) {
      result.set(id, vertical ? { x: p.x, y: total - p.y - size.get(id)!.height } : { x: total - p.x - size.get(id)!.width, y: p.y });
    }
  }
  return result;
}
