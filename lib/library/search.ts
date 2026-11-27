import type { Project } from "@/types/project";
import type { VisualisationSummary, VisualisationType } from "@/types/visualisation";

/** Lower-case, accent-free, single-spaced, so "Café  Menu" matches "cafe menu". */
export function normalise(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export const tokens = (query: string): string[] => normalise(query).split(" ").filter(Boolean);

/** Words people might type to find each kind of visualisation. */
const TYPE_TERMS: Record<VisualisationType, string> = {
  flowchart: "flowchart flow chart process diagram",
  mindmap: "mind map mindmap brainstorm",
  conceptmap: "concept map conceptmap relationships",
  timeline: "timeline roadmap schedule",
  chart: "chart graph data",
  dashboard: "dashboard board charts",
  table: "table data",
};

interface Field {
  text: string;
  weight: number;
}

/**
 * Every query word must appear somewhere (AND). The score favours a title
 * that is, starts with, or has a word starting with the query.
 */
function score(fields: Field[], q: string[], whole: string): number {
  let total = 0;
  for (const word of q) {
    let best = 0;
    for (const f of fields) {
      const t = normalise(f.text);
      if (!t.includes(word)) continue;
      const starts = t.startsWith(word) ? 1.4 : t.split(" ").some((w) => w.startsWith(word)) ? 1.2 : 1;
      best = Math.max(best, f.weight * starts);
    }
    if (best === 0) return 0;
    total += best;
  }
  if (fields[0] && normalise(fields[0].text) === whole) total += 100;
  return total;
}

export interface Ranked<T> {
  item: T;
  score: number;
}

export function searchProjects<T extends Project>(projects: readonly T[], query: string): Ranked<T>[] {
  const q = tokens(query);
  if (q.length === 0) return projects.map((item) => ({ item, score: 0 }));
  const whole = normalise(query);
  return projects
    .map((item) => ({ item, score: score([{ text: item.name, weight: 30 }, { text: item.description, weight: 10 }], q, whole) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function searchVisualisations(items: readonly VisualisationSummary[], projectName: (id: string) => string | undefined, query: string): Ranked<VisualisationSummary>[] {
  const q = tokens(query);
  if (q.length === 0) return items.map((item) => ({ item, score: 0 }));
  const whole = normalise(query);
  return items
    .map((item) => ({
      item,
      score: score(
        [{ text: item.title, weight: 30 }, { text: projectName(item.projectId) ?? "", weight: 15 }, { text: item.description, weight: 10 }, { text: TYPE_TERMS[item.type], weight: 8 }],
        q,
        whole,
      ),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
