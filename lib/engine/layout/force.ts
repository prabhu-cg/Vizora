import type { LEdge, LNode, Pos } from "./layered";

/** Deterministic Fruchterman–Reingold with overlap removal. Same input, same picture. */
export function forceLayout(nodes: readonly LNode[], edges: readonly LEdge[], opts: { gapX: number; gapY: number }): Map<string, Pos> {
  const n = nodes.length;
  const out = new Map<string, Pos>();
  if (n === 0) return out;
  if (n === 1) return out.set(nodes[0]!.id, { x: 0, y: 0 });

  const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
  const avgW = nodes.reduce((a, b) => a + b.width, 0) / n;
  const avgH = nodes.reduce((a, b) => a + b.height, 0) / n;
  const k = Math.sqrt((avgW + opts.gapX) * (avgH + opts.gapY)) * 1.5;
  const radius = Math.max(k, (k * n) / (2 * Math.PI));
  const px = nodes.map((_, i) => Math.cos((2 * Math.PI * i) / n) * radius);
  const py = nodes.map((_, i) => Math.sin((2 * Math.PI * i) / n) * radius);
  const links = edges.filter((e) => idx.has(e.source) && idx.has(e.target) && e.source !== e.target).map((e) => [idx.get(e.source)!, idx.get(e.target)!] as const);

  let temp = radius / 2;
  for (let iter = 0; iter < 300; iter++) {
    const dx = new Array<number>(n).fill(0);
    const dy = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let ex = px[i]! - px[j]!;
        let ey = py[i]! - py[j]!;
        let d = Math.hypot(ex, ey);
        if (d < 0.01) {
          ex = ((i * 7) % 5) - 2 + 0.1;
          ey = ((j * 3) % 5) - 2 + 0.1;
          d = Math.hypot(ex, ey);
        }
        const f = (k * k) / d;
        dx[i]! += (ex / d) * f;
        dy[i]! += (ey / d) * f;
        dx[j]! -= (ex / d) * f;
        dy[j]! -= (ey / d) * f;
      }
    }
    for (const [a, b] of links) {
      const ex = px[a]! - px[b]!;
      const ey = py[a]! - py[b]!;
      const d = Math.max(0.01, Math.hypot(ex, ey));
      const f = (d * d) / k;
      dx[a]! -= (ex / d) * f;
      dy[a]! -= (ey / d) * f;
      dx[b]! += (ex / d) * f;
      dy[b]! += (ey / d) * f;
    }
    for (let i = 0; i < n; i++) {
      dx[i]! -= px[i]! * 0.02; // gentle gravity keeps components together
      dy[i]! -= py[i]! * 0.02;
      const d = Math.max(0.01, Math.hypot(dx[i]!, dy[i]!));
      const step = Math.min(d, temp);
      px[i]! += (dx[i]! / d) * step;
      py[i]! += (dy[i]! / d) * step;
    }
    temp *= 0.985;
  }

  // Remove overlaps between node rectangles.
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i]!, b = nodes[j]!;
        const ox = (a.width + b.width) / 2 + opts.gapX / 2 - Math.abs(px[i]! - px[j]!);
        const oy = (a.height + b.height) / 2 + opts.gapY / 2 - Math.abs(py[i]! - py[j]!);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (ox < oy) {
            const s = (px[i]! >= px[j]! ? 1 : -1) * (ox / 2 + 0.5);
            px[i]! += s;
            px[j]! -= s;
          } else {
            const s = (py[i]! >= py[j]! ? 1 : -1) * (oy / 2 + 0.5);
            py[i]! += s;
            py[j]! -= s;
          }
        }
      }
    }
    if (!moved) break;
  }

  nodes.forEach((nd, i) => out.set(nd.id, { x: px[i]! - nd.width / 2, y: py[i]! - nd.height / 2 }));
  return out;
}
