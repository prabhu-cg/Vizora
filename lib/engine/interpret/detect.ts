import type { EngineType } from "../semantics";
import { findDate } from "./dates";
import { buildOutline, outlineDepth, type Line } from "./lines";
import type { Detection } from "./types";
import { RELATION_RE } from "./concept";

const COND = /\b(?:if|otherwise|else|whether|when)\b|\?\s*$/i;
const SEQ = /\b(?:then|next|after that|afterwards|finally|first|second|third)\b|->|→/i;

export interface Signals {
  scores: Record<EngineType, number>;
  facts: string[];
}

/** Score each type from observable features of the text. Pure and explainable. */
export function scoreText(text: string, lines: readonly Line[], typeHint?: EngineType): Signals {
  const scores: Record<EngineType, number> = { flowchart: 0, mindmap: 0, orgchart: 0, conceptmap: 0, timeline: 0 };
  const facts: string[] = [];
  const body = lines.map((l) => l.text);

  const dated = body.filter((t) => findDate(t, { allowRelative: true })).length;
  if (dated >= 2) {
    scores.timeline += Math.min(0.9, 0.5 + dated * 0.1);
    facts.push(`${dated} dated lines`);
  }
  if (/\bmilestone|roadmap|timeline\b/i.test(text)) scores.timeline += 0.25;

  const conds = body.filter((t) => COND.test(t)).length;
  const seqs = body.filter((t) => SEQ.test(t)).length;
  const numbered = lines.filter((l) => l.marker === "number" && !l.numbering?.includes(".")).length;
  if (conds > 0) {
    scores.flowchart += Math.min(0.85, 0.45 + conds * 0.15);
    facts.push(`${conds} conditional${conds === 1 ? "" : "s"}`);
  }
  if (numbered >= 3 || seqs >= 1) {
    scores.flowchart += 0.35;
    facts.push(numbered >= 3 ? `${numbered} numbered steps` : "sequence words");
  }
  if (/\b(?:process|workflow|steps?|procedure|flow)\b/i.test(text)) scores.flowchart += 0.15;

  // An org chart is never guessed from structure alone (it looks like a mind map); the words have to say so.
  if (/\borg(?:ani[sz]ation(?:al)?)?\s?-?chart\b|\breporting lines?\b|\bwho reports to whom\b/i.test(text)) scores.orgchart += 1.2;

  const forest = buildOutline(lines);
  const depth = outlineDepth(forest);
  if (depth >= 2) {
    scores.mindmap += dated >= 2 || conds > 0 ? 0.25 : 0.6;
    facts.push(`outline ${depth} levels deep`);
  }
  if (/\bbrainstorm|mind\s?map|ideas?\b/i.test(text)) scores.mindmap += 0.2;
  if (lines.length === 1 && /:\s*[^,]+(?:,[^,]+){2,}/.test(body[0] ?? "")) scores.mindmap += 0.4;

  const arrows = body.filter((t) => /(?:-{1,2}\[?[^\]>]*\]?-{1,2}>|→|->)/.test(t) && /\S\s*(?:-{1,2}\[?[^\]>]*\]?-{1,2}>|→|->)\s*\S/.test(t)).length;
  const rels = body.filter((t) => RELATION_RE.test(t)).length;
  if (rels >= 2) {
    scores.conceptmap += Math.min(0.85, 0.35 + rels * 0.12);
    facts.push(`${rels} relationship statements`);
  }
  if (arrows >= 1 && conds === 0) {
    scores.conceptmap += 0.3;
    scores.flowchart += 0.2;
  }
  if (/\brelationships?|concepts?|depends on\b/i.test(text)) scores.conceptmap += 0.2;

  if (typeHint) {
    scores[typeHint] += 1;
    facts.unshift(`your request mentions ${typeHint === "conceptmap" ? "relationships" : typeHint}`);
  }
  for (const k of Object.keys(scores) as EngineType[]) scores[k] = Math.min(1, scores[k]);
  return { scores, facts };
}

export function detectType(text: string, lines: readonly Line[], typeHint?: EngineType): Detection {
  const { scores, facts } = scoreText(text, lines, typeHint);
  const ranked = (Object.entries(scores) as [EngineType, number][]).sort((a, b) => b[1] - a[1]);
  const [best, bestScore] = ranked[0]!;
  const second = ranked[1]![1];
  if (bestScore < 0.35) {
    return { type: "flowchart", confidence: 0.2, alternatives: ranked.slice(1).map(([t]) => t), reason: "nothing in the text clearly points to one type", chosen: false };
  }
  const confidence = Math.max(0.3, Math.min(0.95, bestScore - Math.max(0, second - 0.2) * 0.5));
  return {
    type: best,
    confidence,
    alternatives: ranked.slice(1).filter(([, s]) => s > 0).map(([t]) => t),
    reason: facts.length ? facts.slice(0, 3).join(", ") : "best match",
    chosen: false,
  };
}
