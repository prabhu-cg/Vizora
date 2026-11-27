import { compareByCustomOrder } from "@/lib/storage/order";
import type { Project, ProjectWithStats } from "@/types/project";
import type { VisualisationSummary } from "@/types/visualisation";

export const PROJECT_SORTS = {
  modified: "Recently modified",
  "modified-asc": "Least recently modified",
  name: "Name, A to Z",
  "name-desc": "Name, Z to A",
  created: "Newest first",
  size: "Most visualisations",
} as const;
export type ProjectSort = keyof typeof PROJECT_SORTS;

export const VISUALISATION_SORTS = {
  custom: "My order",
  modified: "Recently modified",
  name: "Name, A to Z",
  type: "Type",
  created: "Newest first",
} as const;
export type VisualisationSort = keyof typeof VISUALISATION_SORTS;

const text = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
const date = (a: string, b: string) => b.localeCompare(a); // newest first

/** A stable sort by the chosen key. Ties fall back to name, so the order never jitters. */
export function sortProjects<T extends Project & Partial<Pick<ProjectWithStats, "visualisationCount">>>(list: readonly T[], by: ProjectSort): T[] {
  const cmp: Record<ProjectSort, (a: T, b: T) => number> = {
    modified: (a, b) => date(a.updatedAt, b.updatedAt),
    "modified-asc": (a, b) => -date(a.updatedAt, b.updatedAt),
    name: (a, b) => text(a.name, b.name),
    "name-desc": (a, b) => text(b.name, a.name),
    created: (a, b) => date(a.createdAt, b.createdAt),
    size: (a, b) => (b.visualisationCount ?? 0) - (a.visualisationCount ?? 0),
  };
  return [...list].sort((a, b) => cmp[by](a, b) || text(a.name, b.name) || a.id.localeCompare(b.id));
}

export function sortVisualisations(list: readonly VisualisationSummary[], by: VisualisationSort): VisualisationSummary[] {
  const cmp: Record<VisualisationSort, (a: VisualisationSummary, b: VisualisationSummary) => number> = {
    custom: compareByCustomOrder,
    modified: (a, b) => date(a.updatedAt, b.updatedAt),
    name: (a, b) => text(a.title, b.title),
    type: (a, b) => text(a.type, b.type),
    created: (a, b) => date(a.createdAt, b.createdAt),
  };
  return [...list].sort((a, b) => cmp[by](a, b) || text(a.title, b.title) || a.id.localeCompare(b.id));
}

/** Move one id up or down in a list of ids; returns the same array when it cannot move. */
export function moveId(ids: readonly string[], id: string, delta: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const out = [...ids];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

export function moveIdTo(ids: readonly string[], id: string, index: number): string[] {
  const rest = ids.filter((x) => x !== id);
  if (rest.length === ids.length) return [...ids];
  rest.splice(Math.max(0, Math.min(rest.length, index)), 0, id);
  return rest;
}
