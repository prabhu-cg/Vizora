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
  run(document: VisualisationIR): ExportArtifact;
}
