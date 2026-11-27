import type { ColorKey, EngineType } from "../semantics";

/** Renderer-independent result of interpretation, before layout. */
export interface SemanticItem {
  id: string;
  kind: string;
  label: string;
  description?: string;
  category?: string;
  date?: string;
  dateLabel?: string;
  color?: ColorKey;
  structural?: boolean;
  collapsed?: boolean;
  /** Flowchart swimlane, from a trailing [Lane] on the line. */
  lane?: string;
}

export interface SemanticLink {
  from: string;
  to: string;
  label?: string;
  directed?: boolean;
}

export interface SemanticGraph {
  type: EngineType;
  title: string;
  items: SemanticItem[];
  links: SemanticLink[];
  /** Swimlanes in order of first appearance (flowcharts only). */
  lanes?: string[];
  /** Layout preferences discovered while reading (e.g. relationships are mostly hierarchical). */
  layoutHint?: { algorithm?: "layered" | "force" | "tree" | "linear"; direction?: "TB" | "LR" };
}

export interface Warning {
  code: string;
  message: string;
  /** 1-based line in the input, when attributable. */
  line?: number;
  severity: "info" | "warning";
}

export interface Detection {
  type: EngineType;
  confidence: number;
  alternatives: EngineType[];
  reason: string;
  /** True when the user chose the type rather than it being detected. */
  chosen: boolean;
}

export interface Interpretation {
  graph: SemanticGraph;
  warnings: Warning[];
  detection: Detection;
  /** True when the input only described what to draw and contained nothing to structure. */
  requestOnly: boolean;
}

export interface InterpretOptions {
  type?: EngineType | "auto";
  /** Overrides the derived title. */
  title?: string;
}

export const MAX_INPUT_CHARS = 20_000;
export const MAX_ITEMS = 300;
