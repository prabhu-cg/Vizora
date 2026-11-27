import type { IREdge, IRNode, VisualisationType } from "@/types/visualisation";

/**
 * Conventions layered on the (unchanged) IR node/edge shapes. Structure lives
 * in the IR proper (type, label, position, edges); everything optional and
 * renderer-agnostic lives in `node.data`, so every type can carry it and a
 * format switch can keep it even where the new type does not display it.
 */
export const ENGINE_TYPES = ["flowchart", "mindmap", "orgchart", "conceptmap", "timeline"] as const;
export type EngineType = (typeof ENGINE_TYPES)[number];

export function isEngineType(t: VisualisationType): t is EngineType {
  return (ENGINE_TYPES as readonly string[]).includes(t);
}

/** Mind maps and org charts are both trees: parent to child edges in sibling order, with a root. */
export const isTreeType = (t: string): t is "mindmap" | "orgchart" => t === "mindmap" || t === "orgchart";

export type FlowKind = "start" | "end" | "process" | "decision" | "io";
export type MindKind = "topic" | "branch";
export type ConceptKind = "concept";
export type TimelineKind = "event" | "milestone";

export interface KindMeta {
  kind: string;
  label: string;
}

export const NODE_KINDS: Record<EngineType, KindMeta[]> = {
  flowchart: [
    { kind: "start", label: "Start" },
    { kind: "process", label: "Process" },
    { kind: "decision", label: "Decision" },
    { kind: "io", label: "Input / output" },
    { kind: "end", label: "End" },
  ],
  mindmap: [
    { kind: "topic", label: "Central topic" },
    { kind: "branch", label: "Branch" },
  ],
  orgchart: [
    { kind: "topic", label: "Head of the organisation" },
    { kind: "branch", label: "Person or team" },
  ],
  conceptmap: [{ kind: "concept", label: "Concept" }],
  timeline: [
    { kind: "event", label: "Event" },
    { kind: "milestone", label: "Milestone" },
  ],
};

export const DEFAULT_KIND: Record<EngineType, string> = {
  flowchart: "process",
  mindmap: "branch",
  orgchart: "branch",
  conceptmap: "concept",
  timeline: "event",
};

export const COLOR_KEYS = ["default", "amber", "ink", "blue", "green", "red", "grey"] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export const COLOR_LABEL: Record<ColorKey, string> = {
  default: "Default",
  amber: "Amber",
  ink: "Ink",
  blue: "Blue",
  green: "Green",
  red: "Red",
  grey: "Grey",
};

/** CSS custom properties (theme-aware). Exports resolve these to literal colours instead. */
export const COLOR_VAR: Record<ColorKey, string> = {
  default: "var(--border-strong)",
  amber: "var(--chart-1)",
  ink: "var(--chart-2)",
  blue: "var(--chart-3)",
  green: "var(--chart-4)",
  red: "var(--destructive)",
  grey: "var(--chart-5)",
};

/** Colour cycle for mind-map branches and timeline categories. */
export const CATEGORY_CYCLE: ColorKey[] = ["amber", "blue", "green", "red", "ink", "grey"];

export interface NodeExtras {
  description?: string;
  category?: string;
  /** ISO date (YYYY-MM-DD, YYYY-MM, YYYY or YYYY-Qn); absent when undated. */
  date?: string;
  /** The text the date was written as, shown instead of the ISO form. */
  dateLabel?: string;
  collapsed?: boolean;
  /** True for nodes the interpreter added for structure (e.g. Start/End), not from the user's text. */
  structural?: boolean;
  /** Flowchart swimlane this step belongs to (one of the document's lanes). */
  lane?: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

export function getExtras(node: IRNode): NodeExtras {
  const d = node.data;
  return {
    description: str(d.description),
    category: str(d.category),
    date: str(d.date),
    dateLabel: str(d.dateLabel),
    collapsed: d.collapsed === true ? true : undefined,
    structural: d.structural === true ? true : undefined,
    lane: str(d.lane),
  };
}

export function withExtras(node: IRNode, patch: { [K in keyof NodeExtras]?: NodeExtras[K] | null }): IRNode {
  const data: IRNode["data"] = { ...node.data };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "" || v === false) delete data[k];
    else data[k] = v as never;
  }
  return { ...node, data };
}

export function getColor(node: IRNode): ColorKey {
  const c = node.style?.color;
  return typeof c === "string" && (COLOR_KEYS as readonly string[]).includes(c) ? (c as ColorKey) : "default";
}

export function withColor(node: IRNode, color: ColorKey): IRNode {
  const style = { ...(node.style ?? {}) };
  if (color === "default") delete style.color;
  else style.color = color;
  return { ...node, style: Object.keys(style).length ? style : undefined };
}

/** Edges are directed unless explicitly marked otherwise (mind-map links never are). */
export function isDirected(edge: IREdge, type: VisualisationType): boolean {
  if (type === "mindmap" || type === "orgchart" || type === "timeline") return false;
  return edge.data?.directed !== false;
}

export function incomingCount(edges: readonly IREdge[], id: string): number {
  return edges.reduce((n, e) => n + (e.target === id ? 1 : 0), 0);
}
