import { capitalise, cleanLabel } from "../text";
import { GraphBuilder } from "./graph-builder";
import { buildOutline, type Line, type OutlineNode } from "./lines";
import { MAX_ITEMS, type SemanticGraph, type Warning } from "./types";

/**
 * "Ada Lovelace - Chief Engineer", "Ada Lovelace (Chief Engineer)" or
 * "Ada Lovelace, Chief Engineer" → a name and a role. A comma only splits when
 * what comes before it is short enough to be a name.
 */
export function splitPerson(text: string): { name: string; role?: string } {
  const t = cleanLabel(text);
  const dash = /^(.+?)\s+[-–—|]\s+(.+)$/.exec(t);
  if (dash) return { name: cleanLabel(dash[1]!), role: cleanLabel(dash[2]!) };
  const paren = /^(.+?)\s*\(([^()]+)\)$/.exec(t);
  if (paren) return { name: cleanLabel(paren[1]!), role: cleanLabel(paren[2]!) };
  const comma = /^([^,]{1,40}),\s*(.+)$/.exec(t);
  if (comma && comma[1]!.trim().split(/\s+/).length <= 4) return { name: cleanLabel(comma[1]!), role: cleanLabel(comma[2]!) };
  return { name: t };
}

/** An outline of people (indent = reports to the line above) becomes a top-down chart. */
export function interpretOrgChart(lines: readonly Line[], opts: { topic?: string; title: string }): { graph: SemanticGraph; warnings: Warning[] } {
  const g = new GraphBuilder();
  const forest = buildOutline(lines);
  let count = 0;
  let truncated = false;

  const place = (n: OutlineNode, parent: string | undefined) => {
    if (count >= MAX_ITEMS) {
      truncated = true;
      return;
    }
    count++;
    const { name, role } = splitPerson(n.text);
    const item = g.add({ kind: parent ? "branch" : "topic", label: capitalise(name), ...(role ? { description: role } : {}) });
    if (parent) g.link(parent, item.id, undefined, false);
    for (const c of n.children) place(c, item.id);
    return item.id;
  };

  if (forest.length === 0) {
    g.warn("empty", "There was nothing to place on the chart yet. Add people with indented lines, such as “Ada Lovelace - Chief Engineer”, then generate again, or add people by hand.");
  } else if (forest.length === 1) {
    place(forest[0]!, undefined);
  } else {
    const root = g.add({ kind: "topic", label: capitalise(cleanLabel(opts.topic ?? "Organisation")), structural: true });
    g.warn("no-head", "There was no single person at the top, so a box called “Organisation” was added above everyone. Rename it, or indent the lines under one person.");
    count++;
    for (const f of forest) place(f, root.id);
  }
  if (truncated) g.warn("truncated", `Only the first ${MAX_ITEMS} people were used.`);
  return { graph: g.graph("orgchart", opts.title, { algorithm: "tree", direction: "TB" }), warnings: g.warnings };
}
