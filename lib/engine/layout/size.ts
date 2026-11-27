import { getExtras } from "../semantics";
import type { EngineType } from "../semantics";
import { wrapText } from "../text";
import type { IRNode } from "@/types/visualisation";

export const CHAR_W = 7.2; // average glyph width at 14px DM Sans
export const LINE_H = 19;

export interface Size {
  width: number;
  height: number;
}

/** Width in characters available for a node's text, shared with the SVG exporter. */
export function textColumns(width: number, padding = 28): number {
  return Math.max(6, Math.floor((width - padding) / CHAR_W));
}

/**
 * Deterministic node size from kind and text. Layout and export use the same
 * numbers, so what is laid out is what is drawn.
 */
export function measureNode(type: EngineType, node: Pick<IRNode, "type" | "label" | "data">): Size {
  const label = node.label || " ";
  const ex = getExtras(node as IRNode);
  if (type === "timeline") {
    const width = 220;
    const titleLines = wrapText(label, textColumns(width), 3).length;
    const descLines = ex.description ? wrapText(ex.description, textColumns(width), 3).length : 0;
    return { width, height: 22 + titleLines * LINE_H + (descLines ? descLines * 17 + 6 : 0) + 22 };
  }
  if (type === "orgchart") {
    // A person's card: avatar, then the name with their role beneath. Wide enough that a short role stays on one line.
    const role = ex.description ?? "";
    const text = Math.max(label.length, role.length * 0.9);
    const width = Math.min(280, Math.max(208, Math.ceil(text * CHAR_W + 72)));
    const nameLines = wrapText(label, textColumns(width, 72), 2).length;
    const roleLines = role ? wrapText(role, textColumns(width, 72), 2).length : 0;
    return { width, height: Math.max(64, 22 + nameLines * LINE_H + (roleLines ? roleLines * 17 + 3 : 0) + 18) };
  }
  const natural = Math.ceil(label.length * CHAR_W + 32);
  const base = Math.min(260, Math.max(110, natural));
  switch (node.type) {
    case "decision": {
      const width = Math.min(300, Math.max(150, Math.round(base * 1.45)));
      const lines = wrapText(label, textColumns(width * 0.62), 4).length;
      return { width, height: Math.max(84, lines * LINE_H + 50) };
    }
    case "start":
    case "end":
      return { width: Math.max(110, Math.min(180, natural)), height: 44 };
    case "topic": {
      const width = Math.min(260, Math.max(150, natural + 24));
      const lines = wrapText(label, textColumns(width), 3).length;
      return { width, height: Math.max(56, lines * LINE_H + 28) };
    }
    default: {
      const width = base;
      const lines = wrapText(label, textColumns(width), 4).length;
      return { width, height: Math.max(44, lines * LINE_H + 24) };
    }
  }
}
