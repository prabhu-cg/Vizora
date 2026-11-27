import type { IRNode } from "@/types/visualisation";

export type Side = "top" | "right" | "bottom" | "left";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const rectOf = (n: IRNode): Rect => ({ x: n.position.x, y: n.position.y, width: n.size?.width ?? 140, height: n.size?.height ?? 44 });

export function anchorPoint(r: Rect, side: Side): { x: number; y: number } {
  switch (side) {
    case "top":
      return { x: r.x + r.width / 2, y: r.y };
    case "bottom":
      return { x: r.x + r.width / 2, y: r.y + r.height };
    case "left":
      return { x: r.x, y: r.y + r.height / 2 };
    case "right":
      return { x: r.x + r.width, y: r.y + r.height / 2 };
  }
}

/**
 * Which sides two nodes connect on. Shared by the on-screen renderer (handle
 * ids) and the SVG exporter so a connection leaves and enters the same sides in both.
 */
export function connectionSides(a: Rect, b: Rect): { source: Side; target: Side } {
  const dx = b.x + b.width / 2 - (a.x + a.width / 2);
  const dy = b.y + b.height / 2 - (a.y + a.height / 2);
  // Normalise by size so wide cards don't always read as "horizontal".
  const horizontal = Math.abs(dx) / (a.width / 2 + b.width / 2) > Math.abs(dy) / (a.height / 2 + b.height / 2);
  if (horizontal) return dx >= 0 ? { source: "right", target: "left" } : { source: "left", target: "right" };
  return dy >= 0 ? { source: "bottom", target: "top" } : { source: "top", target: "bottom" };
}

const normal: Record<Side, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export interface EdgeGeometry {
  from: { x: number; y: number };
  to: { x: number; y: number };
  c1: { x: number; y: number };
  c2: { x: number; y: number };
  /** Unit vector pointing into the target at the arrow tip. */
  tip: { x: number; y: number };
  mid: { x: number; y: number };
  path: string;
  sides: { source: Side; target: Side };
}

export function edgeGeometry(a: Rect, b: Rect): EdgeGeometry {
  const sides = connectionSides(a, b);
  const from = anchorPoint(a, sides.source);
  const to = anchorPoint(b, sides.target);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const off = Math.max(30, Math.min(140, dist * 0.45));
  const ns = normal[sides.source];
  const nt = normal[sides.target];
  const c1 = { x: from.x + ns.x * off, y: from.y + ns.y * off };
  const c2 = { x: to.x + nt.x * off, y: to.y + nt.y * off };
  const t = 0.5;
  const mt = 1 - t;
  const mid = {
    x: mt ** 3 * from.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t ** 3 * to.x,
    y: mt ** 3 * from.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t ** 3 * to.y,
  };
  return {
    from,
    to,
    c1,
    c2,
    tip: { x: -nt.x, y: -nt.y },
    mid,
    path: `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`,
    sides,
  };
}
