import type { z } from "zod";
import type {
  cellSchema,
  columnSchema,
  datasetSchema,
  edgeSchema,
  layoutSchema,
  nodeSchema,
  sourceSchema,
  viewportSchema,
  visualisationSchema,
  visualisationTypeSchema,
} from "@/lib/validation/visualisation.schema";

/** Renderer-independent Visualisation IR. Derived from the runtime schema so the two cannot diverge. */
export type VisualisationIR = z.infer<typeof visualisationSchema>;
export type VisualisationType = z.infer<typeof visualisationTypeSchema>;
export type VisualisationSource = z.infer<typeof sourceSchema>;
export type IRNode = z.infer<typeof nodeSchema>;
export type IREdge = z.infer<typeof edgeSchema>;
export type IRLayout = z.infer<typeof layoutSchema>;
export type IRViewport = z.infer<typeof viewportSchema>;

export type Cell = z.infer<typeof cellSchema>;
export type Column = z.infer<typeof columnSchema>;
export type Dataset = z.infer<typeof datasetSchema>;

/** A saved visualisation plus the storage metadata needed for conflict detection. */
export interface VisualisationRecord {
  id: string;
  projectId: string;
  /** Monotonic counter; incremented on every successful save. */
  revision: number;
  document: VisualisationIR;
}

/** Lightweight listing shape. */
export interface VisualisationSummary {
  id: string;
  projectId: string;
  revision: number;
  title: string;
  description: string;
  type: VisualisationType;
  nodeCount: number;
  datasetCount: number;
  createdAt: string;
  updatedAt: string;
}
