import { canon, capitalise, cleanLabel, stripDeterminer, wordCount } from "../text";
import { GraphBuilder } from "./graph-builder";
import { splitSentences, type Line } from "./lines";
import type { SemanticGraph, Warning } from "./types";

/** Relationship phrases the engine recognises. Anything else is reported, not guessed. */
const RELATIONS = [
  "is a kind of", "is a type of", "is part of", "is used by", "is owned by", "is managed by", "is supplied by", "is employed by", "depends on", "belongs to",
  "works with", "reports to", "leads to", "are a kind of", "are a type of", "are part of", "are used by", "are owned by", "are managed by", "are supplied by",
  "depend on", "belong to", "work with", "report to", "lead to", "is a", "are a", "has", "have", "contains", "contain", "includes", "include", "requires", "require", "supplies", "supply",
  "buys", "buy", "sells", "sell", "employs", "employ", "manages", "manage", "signs", "sign", "uses", "use", "produces", "produce", "owns", "own", "causes", "cause",
  "creates", "create", "pays", "pay", "delivers", "deliver", "supports", "support", "enables", "enable", "orders", "order", "provides", "provide", "receives",
  "receive", "sends", "send", "follows", "precedes", "influences", "affects", "drives", "controls", "serves", "trains", "teaches",
].sort((a, b) => b.length - a.length);

const HIERARCHICAL = new Set(["is a kind of", "is a type of", "is part of", "are a kind of", "are a type of", "are part of", "belong to", "is a", "are a", "contains", "contain", "includes", "include", "has", "have", "belongs to"]);

const alt = RELATIONS.map((r) => r.replace(/ /g, "\\s+")).join("|");
export const RELATION_RE = new RegExp(`^(.{2,60}?)\\s+(${alt})\\s+(.{2,80})$`, "i");

const ARROW_LABELLED = /^(.+?)\s*[-–]{1,2}\s*\[?\(?([^\]>()]+?)\)?\]?\s*[-–]{1,2}>\s*(.+)$/;
const ARROW_SPLIT = /\s*(?:-{1,2}>|→|=>)\s*/;

function entityLabel(raw: string): string {
  return capitalise(cleanLabel(stripDeterminer(cleanLabel(raw))));
}

export function interpretConcept(
  lines: readonly Line[],
  opts: { title: string; entities?: string[] },
): { graph: SemanticGraph; warnings: Warning[] } {
  const g = new GraphBuilder();
  const ids = new Map<string, string>();
  let hierarchical = 0;
  let relations = 0;

  const concept = (raw: string): string | undefined => {
    const label = entityLabel(raw);
    if (!label || wordCount(label) > 8) return undefined;
    const key = canon(label);
    const hit = ids.get(key);
    if (hit) return hit;
    const item = g.add({ kind: "concept", label });
    ids.set(key, item.id);
    return item.id;
  };

  const relate = (a: string, rel: string | undefined, b: string, line: number) => {
    const from = concept(a);
    const to = concept(b);
    if (!from || !to) {
      g.warn("long-term", `“${cleanLabel(a)}” or “${cleanLabel(b)}” is too long to be one concept, so that statement was skipped.`, line);
      return;
    }
    g.link(from, to, rel ? cleanLabel(rel).toLowerCase() : undefined);
    relations++;
    if (rel && HIERARCHICAL.has(cleanLabel(rel).toLowerCase())) hierarchical++;
  };

  for (const l of lines) {
    const statements = l.marker === "none" ? splitSentences(l.text) : [l.text];
    for (const st of statements.flatMap((s) => s.split(/\s*;\s*/))) {
      const s = cleanLabel(st);
      if (!s) continue;

      const lab = ARROW_LABELLED.exec(s);
      if (lab && !/-{1,2}>\s*.*-{1,2}>/.test(s)) {
        relate(lab[1]!, lab[2]!, lab[3]!, l.line);
        continue;
      }
      if (ARROW_SPLIT.test(s)) {
        const parts = s.split(ARROW_SPLIT).filter(Boolean);
        if (parts.length >= 2) {
          for (let i = 0; i < parts.length - 1; i++) relate(parts[i]!, undefined, parts[i + 1]!, l.line);
          continue;
        }
      }
      const m = RELATION_RE.exec(s);
      if (m && wordCount(m[1]!) <= 6) {
        const objects = m[3]!
          .split(/\s*,\s*(?:and\s+)?|\s+and\s+/i)
          .map((x) => x.trim())
          .filter(Boolean);
        if (objects.every((o) => wordCount(o) <= 8)) {
          for (const o of objects) relate(m[1]!, m[2]!, o, l.line);
          continue;
        }
      }
      // A bare noun phrase is a concept without a stated relationship.
      if (wordCount(s) <= 3 && !/[.?!]$/.test(st.trim())) {
        concept(s);
        g.warn("no-relationship", `“${s}” has no stated relationship, so it is unconnected.`, l.line, "info");
        continue;
      }
      g.warn("unparsed", `No relationship was recognised in “${s.length > 80 ? s.slice(0, 77) + "…" : s}”. Use a phrase such as “A depends on B” or “A -> B”.`, l.line);
    }
  }

  for (const e of opts.entities ?? []) concept(e);
  if (opts.entities?.length && relations === 0) {
    g.warn("entities-only", "Your request names the concepts but not how they relate. They are shown unconnected. Use “Connect to” on a concept to add relationships.");
  }
  if (g.items.length === 0) g.warn("empty", "No concepts or relationships were found yet. Add them in the editor.");

  const hierarchy = relations > 0 && hierarchical / relations >= 0.5;
  return {
    graph: g.graph("conceptmap", opts.title, hierarchy || g.links.length <= g.items.length ? { algorithm: "layered", direction: "TB" } : { algorithm: "force" }),
    warnings: g.warnings,
  };
}
