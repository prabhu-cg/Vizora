import type { LNode, Pos } from "./layered";

export interface TimelineLayout {
  positions: Map<string, Pos>;
  /** Axis line in canvas coordinates. */
  axis: { x1: number; y1: number; x2: number; y2: number };
  /** Which side of the axis each card sits on. */
  sides: Map<string, "before" | "after">;
}

export const STEM = 44;

/**
 * Events alternate on either side of a central axis so neighbouring cards never
 * collide. Order is the order of `nodes`; dates decide that order upstream.
 */
export function timelineLayout(nodes: readonly LNode[], direction: "LR" | "TB" | "RL" | "BT", gap: number): TimelineLayout {
  const positions = new Map<string, Pos>();
  const sides = new Map<string, "before" | "after">();
  const horizontal = direction === "LR" || direction === "RL";
  const maxW = Math.max(0, ...nodes.map((n) => n.width));
  const maxH = Math.max(0, ...nodes.map((n) => n.height));
  let cursor = 0;
  const step = horizontal ? maxW / 2 + gap / 2 + 12 : 0;
  nodes.forEach((n, i) => {
    const before = i % 2 === 0;
    sides.set(n.id, before ? "before" : "after");
    if (horizontal) {
      const x = i * step;
      positions.set(n.id, { x, y: before ? -STEM - n.height : STEM });
    } else {
      const y = cursor;
      positions.set(n.id, { x: before ? -STEM - n.width : STEM, y });
      cursor += n.height / 2 + gap / 2 + 14;
    }
  });
  const last = nodes[nodes.length - 1];
  const axis = horizontal
    ? { x1: -40, y1: 0, x2: Math.max(0, (nodes.length - 1) * step + maxW) + 40, y2: 0 }
    : { x1: 0, y1: -40, x2: 0, y2: Math.max(0, cursor + (last?.height ?? maxH)) + 40 };
  return { positions, axis, sides };
}
