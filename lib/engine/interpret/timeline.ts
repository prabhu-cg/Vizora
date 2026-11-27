import { CATEGORY_CYCLE } from "../semantics";
import { capitalise, cleanLabel } from "../text";
import { findDate, isAbsolute, type FoundDate } from "./dates";
import { GraphBuilder } from "./graph-builder";
import { splitSentences, type Line } from "./lines";
import type { SemanticGraph, Warning } from "./types";

const MILESTONE = /\b(?:milestone|launch|release|go[- ]live|deadline|kick-?off|delivery|sign-?off|completion|completed?|ship(?:s|ped)?)\b/i;
const FILLER_BEFORE = /\b(?:in|on|by|at|during|from|until|before|after|around)\s*$/i;
const SEP = /^\s*(?:[:\-–—|,]|\bis\b|\bwe\b)\s*/i;

interface Draft {
  label: string;
  description?: string;
  category?: string;
  date?: FoundDate;
  milestone: boolean;
  line: number;
  order: number;
}

function takeCategory(text: string): { text: string; category?: string } {
  const b = /\[([^\]]{1,30})\]/.exec(text);
  if (b) return { text: cleanLabel(text.replace(b[0], " ")), category: cleanLabel(b[1]!) };
  const h = /(?:^|\s)#([\p{L}\p{N}_-]{1,30})\b/u.exec(text);
  if (h) return { text: cleanLabel(text.replace(h[0], " ")), category: h[1]!.replace(/[-_]/g, " ") };
  return { text };
}

/** Split "Title — description" on a spaced dash or the first colon after the title. */
function splitTitle(text: string): { title: string; description?: string } {
  const dash = /\s[–—-]\s/.exec(text);
  if (dash) return { title: cleanLabel(text.slice(0, dash.index)), description: cleanLabel(text.slice(dash.index + dash[0].length)) || undefined };
  const colon = /:\s+/.exec(text);
  if (colon && colon.index > 0) return { title: cleanLabel(text.slice(0, colon.index)), description: cleanLabel(text.slice(colon.index + colon[0].length)) || undefined };
  return { title: cleanLabel(text) };
}

export function interpretTimeline(lines: readonly Line[], title: string): { graph: SemanticGraph; warnings: Warning[] } {
  const g = new GraphBuilder();
  const drafts: Draft[] = [];
  let sectionCategory: string | undefined;
  let undated = 0;
  const ambiguous: string[] = [];

  for (const l of lines) {
    if (l.marker === "heading") {
      sectionCategory = cleanLabel(l.text);
      continue;
    }
    const pieces = l.marker === "none" ? splitSentences(l.text) : [l.text];
    for (const piece of pieces) {
      let text = piece;
      let milestone = false;
      const ms = /^(?:milestone\s*[:\-–]\s*|[★⭐🏁]\s*)/i.exec(text);
      if (ms) {
        milestone = true;
        text = text.slice(ms[0].length);
      }
      const cat = takeCategory(text);
      text = cat.text;
      const found = findDate(text, { allowBareYear: true, allowRelative: true });
      let rest = text;
      if (found) {
        const before = text.slice(0, found.index).replace(FILLER_BEFORE, "");
        const after = text.slice(found.index + found.length).replace(SEP, "");
        rest = cleanLabel(before.trim() ? `${before.replace(SEP, "")} ${after}` : after);
        if (found.ambiguous) ambiguous.push(found.label);
      }
      const { title: t, description } = splitTitle(rest);
      if (!t) {
        g.warn("empty-event", `A line had a date (${found?.label ?? "none"}) but no description, so it was skipped.`, l.line);
        continue;
      }
      if (!found) undated++;
      drafts.push({
        label: capitalise(t),
        description,
        category: cat.category ?? sectionCategory,
        date: found,
        milestone: milestone || MILESTONE.test(t),
        line: l.line,
        order: drafts.length,
      });
    }
  }

  if (drafts.length === 0) {
    g.warn("empty", "No events were found yet. Add events in the editor, or write lines such as “2026-03-01: Kick-off”.");
    return { graph: g.graph("timeline", title, { algorithm: "linear", direction: "LR" }), warnings: g.warnings };
  }

  const allAbsolute = drafts.every((d) => d.date && isAbsolute(d.date.precision));
  let ordered = drafts;
  if (allAbsolute) {
    ordered = [...drafts].sort((a, b) => a.date!.sortKey - b.date!.sortKey || a.order - b.order);
    if (ordered.some((d, i) => d !== drafts[i])) g.warn("reordered", "Events were sorted by date; they were not in date order in your text.", undefined, "info");
  } else {
    const keyed = drafts.filter((d) => d.date);
    const sorted = keyed.every((d, i) => i === 0 || keyed[i - 1]!.date!.precision === "relative" || d.date!.precision === "relative" || keyed[i - 1]!.date!.sortKey <= d.date!.sortKey);
    if (!sorted) g.warn("out-of-order", "Some dated events are not in date order. Your order was kept; use Move earlier / later to adjust.");
    if (undated > 0) g.warn("undated", `${undated} event${undated === 1 ? " has" : "s have"} no date, so your original order was kept. Add dates in the editor to sort by date.`);
    if (drafts.some((d) => d.date?.precision === "relative")) g.warn("relative", "Relative markers such as “Week 2” cannot be placed on a calendar, so your order was kept.", undefined, "info");
  }
  if (ambiguous.length) g.warn("ambiguous-date", `${[...new Set(ambiguous)].slice(0, 3).join(", ")} could be day/month or month/day. Day first (UK style) was assumed.`);

  const colours = new Map<string, (typeof CATEGORY_CYCLE)[number]>();
  for (const d of ordered) {
    if (d.category && !colours.has(d.category.toLowerCase())) colours.set(d.category.toLowerCase(), CATEGORY_CYCLE[colours.size % CATEGORY_CYCLE.length]!);
    g.add({
      kind: d.milestone ? "milestone" : "event",
      label: d.label,
      description: d.description,
      category: d.category,
      date: d.date?.value,
      dateLabel: d.date?.label,
      color: d.category ? colours.get(d.category.toLowerCase()) : undefined,
    });
  }
  return { graph: g.graph("timeline", title, { algorithm: "linear", direction: "LR" }), warnings: g.warnings };
}
