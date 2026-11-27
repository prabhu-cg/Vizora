/** Small, deterministic text helpers shared by the interpreter, layout and exports. */

export function collapseSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Trim whitespace and trailing sentence punctuation; never rewrites the words. */
export function cleanLabel(s: string): string {
  return collapseSpace(s).replace(/^[\s"“”'‘’]+|[\s"“”'‘’.,;:!]+$/g, "").replace(/\s+([,.;:!?])/g, "$1");
}

export function capitalise(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

const DETERMINERS = /^(?:a|an|the|each|every|some|any|all|our|their|its|his|her|my|your)\s+/i;

/** Key for treating two mentions as the same concept: case, determiners and a trailing plural "s" are ignored. */
export function canon(s: string): string {
  let t = collapseSpace(s).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "");
  t = t.replace(DETERMINERS, "");
  return t
    .split(" ")
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join(" ")
    .trim();
}

export function stripDeterminer(s: string): string {
  return s.replace(DETERMINERS, "");
}

export function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

const STOP = new Set(["the", "a", "an", "to", "of", "and", "or", "in", "on", "for", "with", "is", "are", "step"]);

/** Word-overlap similarity (Jaccard) over content words, 0..1. */
export function similarity(a: string, b: string): number {
  const words = (s: string) => new Set(canon(s).split(" ").filter((w) => w && !STOP.has(w)));
  const A = words(a);
  const B = words(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Greedy word wrap by character count. Used for both sizing and SVG export so they agree. */
export function wrapText(text: string, maxChars: number, maxLines = Infinity): string[] {
  const words = collapseSpace(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if ((line + " " + w).length <= maxChars) line += " " + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  // Hard-break very long single words.
  const broken = lines.flatMap((l) => (l.length > maxChars * 1.4 ? (l.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [l]) : [l]));
  if (broken.length > maxLines) {
    const kept = broken.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1]!.replace(/.{0,1}$/, "…");
    return kept;
  }
  return broken.length ? broken : [""];
}
