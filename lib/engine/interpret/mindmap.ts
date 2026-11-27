import { CATEGORY_CYCLE } from "../semantics";
import { capitalise, cleanLabel, similarity, wordCount } from "../text";
import { GraphBuilder } from "./graph-builder";
import { buildOutline, type Line, type OutlineNode } from "./lines";
import { MAX_ITEMS, type SemanticGraph, type Warning } from "./types";

/** "Marketing: SEO, ads, email" → children, but only for short comma-separated items. */
function colonList(text: string): { head: string; parts: string[] } | undefined {
  const m = /^(.{1,80}?):\s*(.+)$/.exec(text);
  if (!m) return undefined;
  const parts = m[2]!
    .split(/\s*,\s*(?:and\s+)?|\s*;\s*/i)
    .map(cleanLabel)
    .filter(Boolean);
  if (parts.length < 2 || parts.some((p) => wordCount(p) > 6)) return undefined;
  return { head: cleanLabel(m[1]!), parts };
}

function expandColonLists(nodes: OutlineNode[]): void {
  for (const n of nodes) {
    if (n.children.length === 0) {
      const c = colonList(n.text);
      if (c) {
        n.text = c.head;
        n.children = c.parts.map((p) => ({ text: p, line: n.line, marker: "bullet", children: [] }));
      }
    } else expandColonLists(n.children);
  }
}

export function interpretMindmap(
  lines: readonly Line[],
  opts: { topic?: string; title: string },
): { graph: SemanticGraph; warnings: Warning[] } {
  const g = new GraphBuilder();
  const forest = buildOutline(lines);
  expandColonLists(forest);

  let rootLabel: string | undefined = opts.topic;
  let rootStructural = false;
  let branches: OutlineNode[];

  if (rootLabel) {
    if (forest.length === 1 && forest[0]!.children.length > 0 && similarity(forest[0]!.text, rootLabel) >= 0.5) branches = forest[0]!.children;
    else branches = forest;
  } else if (forest.length === 1 && forest[0]!.children.length > 0) {
    rootLabel = forest[0]!.text;
    branches = forest[0]!.children;
  } else {
    rootLabel = "Main topic";
    rootStructural = true;
    branches = forest;
    if (forest.length > 0) g.warn("no-root", "No central topic was found, so one called “Main topic” was added. Rename it in the editor.");
  }

  if (forest.length === 0) {
    g.warn("empty", "There was nothing to place on the map yet, so only the central topic was created. Add branches in the editor.");
  }

  const root = g.add({ kind: "topic", label: capitalise(cleanLabel(rootLabel)), structural: rootStructural || undefined });
  let count = 1;
  let truncated = false;
  const seen = new Map<string, number>();

  const place = (n: OutlineNode, parent: string, color: (typeof CATEGORY_CYCLE)[number]) => {
    if (count >= MAX_ITEMS) {
      truncated = true;
      return;
    }
    count++;
    const label = capitalise(cleanLabel(n.text));
    const item = g.add({ kind: "branch", label, color });
    seen.set(label.toLowerCase(), (seen.get(label.toLowerCase()) ?? 0) + 1);
    g.link(parent, item.id, undefined, false);
    for (const c of n.children) place(c, item.id, color);
  };
  branches.forEach((b, i) => place(b, root.id, CATEGORY_CYCLE[i % CATEGORY_CYCLE.length]!));

  for (const [label, n] of seen) {
    if (n > 1) g.warn("repeated", `“${label}” appears ${n} times in different places. Mind maps are trees, so each is kept separately.`, undefined, "info");
  }
  if (truncated) g.warn("truncated", `Only the first ${MAX_ITEMS} items were used.`);
  return { graph: g.graph("mindmap", opts.title, { algorithm: "tree", direction: "LR" }), warnings: g.warnings };
}
