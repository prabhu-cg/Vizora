import { collapseSpace } from "../text";

export type Marker = "number" | "bullet" | "heading" | "none";

export interface Line {
  /** 1-based line number in the original input. */
  line: number;
  text: string;
  marker: Marker;
  /** Outline depth, 0 = top level. */
  depth: number;
  /** The "1.2.3" style number when present. */
  numbering?: string;
}

const MARKER = /^(?<indent>[ \t]*)(?:(?<hash>#{1,6})\s+|(?<num>\d+(?:\.\d+)*)[.)]\s+|(?<alpha>[a-zA-Z])[.)]\s+|(?<bullet>[-*•–—+])\s+)(?<rest>.*)$/;

/**
 * Split input into meaningful lines and work out outline depth from, in order
 * of authority: markdown heading level, dotted numbering (1.2.3), then
 * indentation relative to earlier lines.
 */
export function parseLines(input: string): Line[] {
  const raw = input.replace(/\r\n?/g, "\n").split("\n");
  const out: Line[] = [];
  const indents: number[] = []; // stack of distinct indent widths seen, ascending
  raw.forEach((rawLine, i) => {
    if (!rawLine.trim()) return;
    const m = MARKER.exec(rawLine);
    const width = (rawLine.match(/^[ \t]*/)![0]).replace(/\t/g, "    ").length;
    let marker: Marker = "none";
    let text = collapseSpace(rawLine);
    let depth = 0;
    let numbering: string | undefined;
    if (m?.groups) {
      text = collapseSpace(m.groups.rest ?? "");
      if (m.groups.hash) {
        marker = "heading";
        depth = m.groups.hash.length - 1;
      } else if (m.groups.num) {
        marker = "number";
        numbering = m.groups.num;
        depth = m.groups.num.split(".").length - 1;
      } else {
        marker = "bullet";
      }
    }
    if (!text) return;
    if (marker !== "heading" && !(marker === "number" && numbering?.includes("."))) {
      // Indentation-derived depth.
      while (indents.length && indents[indents.length - 1]! > width) indents.pop();
      if (!indents.length || indents[indents.length - 1]! < width) indents.push(width);
      depth = Math.max(depth, indents.length - 1);
    } else {
      indents.length = 0;
      indents.push(width);
    }
    out.push({ line: i + 1, text, marker, depth, numbering });
  });
  return out;
}

export interface OutlineNode {
  text: string;
  line: number;
  marker: Marker;
  children: OutlineNode[];
}

/** Turn depth-annotated lines into a forest. A jump of more than one level attaches to the nearest ancestor. */
export function buildOutline(lines: readonly Line[]): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: { depth: number; node: OutlineNode }[] = [];
  for (const l of lines) {
    const node: OutlineNode = { text: l.text, line: l.line, marker: l.marker, children: [] };
    while (stack.length && stack[stack.length - 1]!.depth >= l.depth) stack.pop();
    if (stack.length) stack[stack.length - 1]!.node.children.push(node);
    else roots.push(node);
    stack.push({ depth: l.depth, node });
  }
  return roots;
}

export function outlineDepth(forest: readonly OutlineNode[]): number {
  let max = 0;
  const walk = (nodes: readonly OutlineNode[], d: number) => {
    for (const n of nodes) {
      max = Math.max(max, d);
      walk(n.children, d + 1);
    }
  };
  walk(forest, 1);
  return max;
}

/** Split into sentences, keeping common abbreviations and decimals intact. */
export function splitSentences(text: string): string[] {
  const protectedText = text.replace(/\b(e\.g|i\.e|etc|vs|approx|inc|ltd|no)\./gi, (m) => m.replace(".", "\u0000")).replace(/(\d)\.(\d)/g, "$1\u0001$2");
  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])|\n+/)
    .map((s) => s.replace(/\u0000/g, ".").replace(/\u0001/g, ".").trim())
    .filter(Boolean);
}
