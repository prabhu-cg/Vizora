import type { FeatureId } from "@/features/entitlements";
import type { VisualisationIR } from "@/types/visualisation";

export interface ExportArtifact {
  filename: string;
  blob: Blob;
}

/** A pluggable export format. New formats register here; the manager enforces entitlements. */
export interface Exporter {
  id: string;
  label: string;
  description: string;
  feature: FeatureId;
  /** Whether this format applies to the document (e.g. tables have no picture to export). */
  supports?(document: VisualisationIR): boolean;
  run(document: VisualisationIR): ExportArtifact | Promise<ExportArtifact>;
}
