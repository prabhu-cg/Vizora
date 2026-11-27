import {
  CURRENT_VISUALISATION_SCHEMA_VERSION,
  formatZodError,
  migrateDocument,
  visualisationSchema,
  type MigrationStep,
} from "@/lib/validation";
import type { VisualisationIR } from "@/types/visualisation";
import { DEFAULT_LAYOUT, DEFAULT_VIEWPORT } from "./defaults";

/**
 * Visualisation migration registry. `steps[n]` upgrades schema n → n+1.
 * To change the IR: bump CURRENT_VISUALISATION_SCHEMA_VERSION, update the
 * schema, add `steps[oldVersion]`, and add a fixture test.
 */
const steps: Record<number, MigrationStep> = {
  // v2 → v3: charts gained a full configuration (`options.chart`) and "dashboard" was added.
  // The old single `chartKind` becomes the chart's kind; everything else is derived automatically.
  2: (doc) => {
    if (doc.type !== "chart") return doc;
    const cfg = (doc.configuration ?? { options: {} }) as { options?: Record<string, unknown> };
    const { chartKind, ...rest } = cfg.options ?? {};
    const kind = chartKind === "line" ? "line" : chartKind === "bar" ? "bar" : undefined;
    return { ...doc, configuration: { ...cfg, options: kind && !rest.chart ? { ...rest, chart: { kind } } : rest } };
  },

  // v1 → v2: "diagram" became "flowchart" (with explicit node kinds); "conceptmap" and the
  // "linear" layout were added. Diagram nodes of kind "default" are process steps.
  1: (doc) => {
    const wasDiagram = doc.type === "diagram";
    const nodes = Array.isArray(doc.nodes)
      ? (doc.nodes as Record<string, unknown>[]).map((n) => {
          if (!wasDiagram) return n;
          const kind = n.type === "input" || n.type === "output" ? "io" : n.type === "default" || n.type === undefined ? "process" : n.type;
          return { ...n, type: kind };
        })
      : doc.nodes;
    return { ...doc, type: wasDiagram ? "flowchart" : doc.type, nodes };
  },

  // v0 (unversioned pre-release documents) → v1: fill every field the v1 IR requires.
  0: (doc) => {
    const now = new Date().toISOString();
    const updatedAt = typeof doc.updatedAt === "string" ? doc.updatedAt : now;
    return {
      ...doc,
      title: typeof doc.title === "string" && doc.title.trim() ? doc.title : "Untitled visualisation",
      description: typeof doc.description === "string" ? doc.description : "",
      type: doc.type ?? "diagram",
      source: doc.source ?? { kind: "manual" },
      nodes: doc.nodes ?? [],
      edges: doc.edges ?? [],
      data: doc.data ?? { datasets: [] },
      configuration: doc.configuration ?? { options: {} },
      layout: doc.layout ?? DEFAULT_LAYOUT,
      viewport: doc.viewport ?? DEFAULT_VIEWPORT,
      createdAt: typeof doc.createdAt === "string" ? doc.createdAt : updatedAt,
      updatedAt,
    };
  },
};

export class InvalidVisualisationError extends Error {
  override name = "InvalidVisualisationError";
}

/** Migrate any supported historical shape to the current IR, then strictly validate it. */
export function parseVisualisation(raw: unknown): VisualisationIR {
  const migrated = migrateDocument(raw, {
    kind: "visualisation",
    current: CURRENT_VISUALISATION_SCHEMA_VERSION,
    steps,
  });
  const result = visualisationSchema.safeParse(migrated);
  if (!result.success) {
    throw new InvalidVisualisationError(`Invalid visualisation: ${formatZodError(result.error)}`);
  }
  return result.data;
}
