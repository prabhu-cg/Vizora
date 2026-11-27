import { canon, capitalise, cleanLabel, similarity, stripDeterminer } from "../text";
import { GraphBuilder } from "./graph-builder";
import { splitSentences, type Line } from "./lines";
import type { SemanticGraph, Warning } from "./types";

const START_LIKE = /^(?:start|begin|beginning)\b/i;
const END_LIKE = /^(?:end|finish|finished|done|complete|completed|stop|terminate|exit)\b/i;
const IO_LIKE = /^(?:input|output|read|print|display|enter|receive|submit|upload|download)\b/i;
const LOOP = /^(?:go back to|return to|repeat from|loop back to|back to|go to)\s+(?:step\s+)?(.+)$/i;
const TERMINAL_BRANCH = /^(?:end|stop|finish|exit|terminate|end (?:the )?process|stop (?:the )?process)$/i;

const COND =
  /^(?:if|when|whenever|in case|provided that|should)\s+(?<cond>.+?)\s*(?:,\s*(?:then\s+)?|\bthen\b\s*)(?<yes>.+?)(?:\s*[,;.]?\s*\b(?:otherwise|or else|else|if not|if no|if it is not)\b\s*[,:]?\s*(?<no>.+))?$/i;
const DECISION_PREFIX = /^(?:decision|decide|check|is it)\s*[:\-–]\s*(.+)$/i;
const YESNO = /^(?<which>yes|no|y|n)\s*(?:[:\-–>)]|→)\s*(?<text>.+)$/i;
const SEQ_SPLIT = /\s*(?:,\s*)?\b(?:and then|then|after that|afterwards|next|followed by)\b\s*,?\s*|\s*(?:->|→|=>)\s*|\s*;\s*/i;

interface Segment {
  text: string;
  line: number;
  yesno?: "yes" | "no";
}

function segmentLines(lines: readonly Line[]): Segment[] {
  const out: Segment[] = [];
  for (const l of lines) {
    const y = YESNO.exec(l.text);
    if (y?.groups) {
      out.push({ text: cleanLabel(y.groups.text!), line: l.line, yesno: /^y/i.test(y.groups.which!) ? "yes" : "no" });
      continue;
    }
    const sentences = l.marker === "none" ? splitSentences(l.text) : [l.text];
    for (const s of sentences) {
      if (COND.test(s) || DECISION_PREFIX.test(s) || /\?\s*$/.test(s)) {
        out.push({ text: s, line: l.line });
        continue;
      }
      for (const part of s.split(SEQ_SPLIT)) {
        const t = cleanLabel(part);
        if (t) out.push({ text: t, line: l.line });
      }
    }
  }
  return out;
}

interface Tail {
  id: string;
  label?: string;
}

export function interpretFlowchart(lines: readonly Line[], title: string): { graph: SemanticGraph; warnings: Warning[] } {
  const g = new GraphBuilder();
  const segs = segmentLines(lines);
  const byCanon = new Map<string, string>();
  const contentIds: string[] = [];
  let frontier: Tail[] = [];
  let startId: string | undefined;
  let endId: string | undefined;

  const ensureEnd = () => (endId ??= g.add({ kind: "end", label: "End", structural: true }).id);

  const attach = (id: string) => {
    for (const t of frontier) g.link(t.id, id, t.label);
    frontier = [{ id }];
  };

  const kindFor = (text: string): string => (IO_LIKE.test(text) ? "io" : "process");

  /** Create (or reuse) a node for step text. */
  const stepNode = (text: string, line: number, forceKind?: string): { id: string; reused: boolean } => {
    const key = canon(text);
    const existing = byCanon.get(key);
    if (existing && key) {
      g.warn("repeated", `“${text}” appears more than once, so it is shown once with several connections.`, line, "info");
      return { id: existing, reused: true };
    }
    const kind = forceKind ?? (START_LIKE.test(text) && !startId && contentIds.length === 0 ? "start" : END_LIKE.test(text) ? "end" : kindFor(text));
    const item = g.add({ kind, label: capitalise(text) });
    byCanon.set(key, item.id);
    if (kind === "start") startId = item.id;
    else if (kind === "end") endId = item.id;
    else contentIds.push(item.id);
    return { id: item.id, reused: false };
  };

  const resolveLoopTarget = (ref: string): string | undefined => {
    const n = /^\d+$/.exec(ref.trim());
    if (n) return contentIds[+n[0] - 1];
    let best: { id: string; score: number } | undefined;
    for (const id of contentIds) {
      const score = similarity(ref, g.get(id)!.label);
      if (score >= 0.5 && (!best || score > best.score)) best = { id, score };
    }
    return best?.id;
  };

  /** A branch's text becomes a node, a loop-back, or a jump to End. */
  const branch = (text: string, line: number): { node?: string; loop?: string; end?: boolean } => {
    const t = cleanLabel(text);
    if (TERMINAL_BRANCH.test(t)) return { end: true };
    const loop = LOOP.exec(t);
    if (loop) {
      const target = resolveLoopTarget(cleanLabel(loop[1]!));
      if (target) return { loop: target };
      g.warn("loop-unresolved", `Could not tell which step “${cleanLabel(loop[1]!)}” refers to, so it was kept as a normal step.`, line);
    }
    return { node: stepNode(t, line).id };
  };

  let pendingDecision: { id: string; line: number } | undefined;
  const closeDecisionWithoutOutcomes = () => {
    if (!pendingDecision) return;
    const d = g.get(pendingDecision.id)!;
    g.warn("no-outcomes", `The decision “${d.label}” has no stated outcomes, so both answers lead to the next step. Add the branches in the editor.`, pendingDecision.line);
    pendingDecision = undefined;
  };

  const addDecision = (condText: string) => {
    const label = capitalise(cleanLabel(condText).replace(/\?*$/, "")) + "?";
    const item = g.add({ kind: "decision", label });
    byCanon.set(canon(label), item.id);
    contentIds.push(item.id);
    return item.id;
  };

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!;
    const text = seg.text;

    if (seg.yesno) {
      if (!pendingDecision) {
        g.warn("stray-yesno", `“${seg.yesno === "yes" ? "Yes" : "No"}: ${text}” does not follow a question, so it was read as a normal step.`, seg.line);
        attach(stepNode(text, seg.line).id);
        continue;
      }
      // Collect this and an immediately following opposite branch.
      const branches: Record<"yes" | "no", string | undefined> = { yes: undefined, no: undefined };
      branches[seg.yesno] = text;
      const nextSeg = segs[i + 1];
      if (nextSeg?.yesno && nextSeg.yesno !== seg.yesno) {
        branches[nextSeg.yesno] = nextSeg.text;
        i++;
      }
      wireDecision(pendingDecision.id, branches, seg.line);
      pendingDecision = undefined;
      continue;
    }

    closeDecisionWithoutOutcomes();

    const dp = DECISION_PREFIX.exec(text);
    const cond = COND.exec(text);
    if (cond?.groups) {
      const id = addDecision(cond.groups.cond!);
      attach(id);
      wireDecision(id, { yes: cond.groups.yes!, no: cond.groups.no }, seg.line);
      continue;
    }
    if (dp || /\?\s*$/.test(text)) {
      const id = addDecision(dp ? dp[1]! : text);
      attach(id);
      pendingDecision = { id, line: seg.line };
      frontier = [];
      continue;
    }

    const loop = LOOP.exec(text);
    if (loop) {
      const target = resolveLoopTarget(cleanLabel(loop[1]!));
      if (target) {
        for (const t of frontier) g.link(t.id, target, t.label ?? "repeat");
        frontier = [];
        continue;
      }
      g.warn("loop-unresolved", `Could not tell which step “${cleanLabel(loop[1]!)}” refers to, so it was kept as a normal step.`, seg.line);
    }

    const { id, reused } = stepNode(text, seg.line);
    if (g.get(id)!.kind === "end") {
      attach(id);
      frontier = [];
    } else if (!reused || frontier.length) {
      attach(id);
    }
  }
  closeDecisionWithoutOutcomes();
  // A decision left open at the end: both answers fall through.

  function wireDecision(id: string, b: { yes?: string; no?: string }, line: number) {
    const tails: Tail[] = [];
    const place = (which: "Yes" | "No", text: string | undefined) => {
      if (!text) {
        tails.push({ id, label: which });
        return;
      }
      const r = branch(text, line);
      if (r.end) g.link(id, ensureEnd(), which);
      else if (r.loop) g.link(id, r.loop, which);
      else if (r.node) {
        g.link(id, r.node, which);
        tails.push({ id: r.node });
      }
    };
    place("Yes", b.yes);
    place("No", b.no);
    if (!b.yes && !b.no) tails.length = 0;
    frontier = tails;
    if (!b.yes && !b.no) frontier = [{ id, label: "Yes" }, { id, label: "No" }];
    else if (b.yes && !b.no) g.warn("one-branch", `The decision has only a “yes” outcome stated; “no” continues to the next step.`, line, "info");
    else if (!b.yes && b.no) g.warn("one-branch", `The decision has only a “no” outcome stated; “yes” continues to the next step.`, line, "info");
  }

  if (g.items.length === 0) {
    return { graph: g.graph("flowchart", title), warnings: g.warnings };
  }

  // Structural Start / End, clearly marked so the user can see what was added.
  if (!startId) {
    const first = contentIds[0] ?? endId;
    const start = g.add({ kind: "start", label: "Start", structural: true });
    startId = start.id;
    if (first) g.link(start.id, first);
    // Keep Start first in order.
    g.items.unshift(g.items.pop()!);
  } else {
    const first = contentIds[0];
    if (first && !g.links.some((l) => l.from === startId)) g.link(startId, first);
  }
  if (frontier.length) {
    const end = ensureEnd();
    for (const t of frontier) g.link(t.id, end, t.label);
  }
  if (endId && !g.items.some((i) => i.id === endId)) g.items.push({ id: endId, kind: "end", label: "End", structural: true });
  // Move End to the last position.
  if (endId) {
    const idx = g.items.findIndex((i) => i.id === endId);
    if (idx >= 0) g.items.push(g.items.splice(idx, 1)[0]!);
  }

  const orphans = g.items.filter((i) => i.kind !== "start" && !g.links.some((l) => l.to === i.id));
  for (const o of orphans) g.warn("unreachable", `“${o.label}” is not reached from the start. Connect it in the editor.`, undefined);

  void stripDeterminer;
  return { graph: g.graph("flowchart", title, { algorithm: "layered", direction: "TB" }), warnings: g.warnings };
}
