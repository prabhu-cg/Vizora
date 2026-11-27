import { CURRENT_VISUALISATION_SCHEMA_VERSION } from "@/lib/validation";
import { createId } from "@/lib/utils/id";
import { nowIso } from "@/lib/utils/time";
import type { IRNode, VisualisationIR, VisualisationType } from "@/types/visualisation";
import { DEFAULT_LAYOUT, DEFAULT_VIEWPORT } from "./defaults";

export interface NewVisualisationInput {
  title: string;
  type: VisualisationType;
  description?: string;
}

export function createVisualisation(input: NewVisualisationInput): VisualisationIR {
  const now = nowIso();
  return {
    id: createId(),
    schemaVersion: CURRENT_VISUALISATION_SCHEMA_VERSION,
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    type: input.type,
    source: { kind: "manual" },
    nodes: [],
    edges: [],
    data: { datasets: [] },
    configuration: { options: {} },
    layout: { ...DEFAULT_LAYOUT, spacing: { ...DEFAULT_LAYOUT.spacing } },
    viewport: { ...DEFAULT_VIEWPORT },
    createdAt: now,
    updatedAt: now,
  };
}

export function createNode(partial: Partial<IRNode> & Pick<IRNode, "position">): IRNode {
  return {
    id: createId(),
    type: "default",
    label: "New node",
    data: {},
    ...partial,
  };
}
