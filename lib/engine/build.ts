import { createVisualisation } from "@/lib/visualisation/factory";
import { defaultLayoutFor } from "@/lib/visualisation/defaults";
import { nowIso } from "@/lib/utils/time";
import type { IREdge, IRNode, VisualisationIR } from "@/types/visualisation";
import type { Interpretation, SemanticGraph, SemanticItem } from "./interpret";
import { applyLayout } from "./layout";
import { withColor, withExtras } from "./semantics";

/** Semantic item → IR node (positions are filled in by layout). */
export function itemToNode(item: SemanticItem): IRNode {
  let node: IRNode = { id: item.id, type: item.kind, label: item.label, position: { x: 0, y: 0 }, data: {} };
  node = withExtras(node, {
    description: item.description,
    category: item.category,
    date: item.date,
    dateLabel: item.dateLabel,
    collapsed: item.collapsed,
    structural: item.structural,
  });
  return item.color ? withColor(node, item.color) : node;
}

export function graphToDocument(graph: SemanticGraph, base?: VisualisationIR): VisualisationIR {
  const seed = base ?? createVisualisation({ title: graph.title, type: graph.type });
  const defaults = defaultLayoutFor(graph.type);
  const hint = graph.layoutHint ?? {};
  const edges: IREdge[] = graph.links.map((l, i) => ({
    id: `e${i + 1}`,
    source: l.from,
    target: l.to,
    ...(l.label ? { label: l.label } : {}),
    ...(l.directed === false ? { data: { directed: false } } : {}),
  }));
  return applyLayout({
    ...seed,
    title: graph.title.trim().slice(0, 200) || seed.title,
    type: graph.type,
    nodes: graph.items.map(itemToNode),
    edges,
    layout: { ...defaults, algorithm: hint.algorithm ?? defaults.algorithm, direction: hint.direction ?? defaults.direction },
    viewport: { x: 0, y: 0, zoom: 1 },
  });
}

/** Everything needed to re-open the interpretation later: the text and what was noticed. */
export function interpretationOptions(text: string, it: Interpretation): Record<string, string | number | boolean | null | unknown[] | Record<string, unknown>> {
  return {
    inputText: text,
    interpretation: {
      detected: it.detection.type,
      confidence: Math.round(it.detection.confidence * 100) / 100,
      chosen: it.detection.chosen,
      requestOnly: it.requestOnly,
      warnings: it.warnings.map((w) => ({ code: w.code, message: w.message, severity: w.severity, ...(w.line ? { line: w.line } : {}) })),
    },
  };
}

/** Interpretation → a complete, laid-out visualisation document that remembers its source text. */
export function documentFromInterpretation(text: string, it: Interpretation, base?: VisualisationIR): VisualisationIR {
  const doc = graphToDocument(it.graph, base);
  const now = nowIso();
  return {
    ...doc,
    source: { kind: "text", size: text.length, importedAt: now },
    configuration: { options: { ...doc.configuration.options, ...interpretationOptions(text, it) } as VisualisationIR["configuration"]["options"] },
    updatedAt: base ? base.updatedAt : doc.updatedAt,
  };
}

export function readWarnings(doc: VisualisationIR): { code: string; message: string; severity: "info" | "warning"; line?: number }[] {
  const interp = doc.configuration.options.interpretation as { warnings?: unknown } | undefined;
  const w = interp?.warnings;
  if (!Array.isArray(w)) return [];
  return w.filter((x): x is { code: string; message: string; severity: "info" | "warning"; line?: number } => typeof x === "object" && x !== null && typeof (x as { message?: unknown }).message === "string");
}

export function readInputText(doc: VisualisationIR): string | undefined {
  const t = doc.configuration.options.inputText;
  return typeof t === "string" ? t : undefined;
}
