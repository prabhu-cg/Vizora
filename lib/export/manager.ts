import type { EntitlementService } from "@/features/entitlements";
import type { VisualisationIR } from "@/types/visualisation";
import { jsonExporter } from "./json-exporter";
import type { ExportArtifact, Exporter } from "./types";

export interface ExportManager {
  /** Exporters the active plan may use. */
  available(): Exporter[];
  export(exporterId: string, document: VisualisationIR): ExportArtifact;
}

export function createExportManager(
  entitlements: EntitlementService,
  exporters: Exporter[] = [jsonExporter],
): ExportManager {
  const byId = new Map(exporters.map((e) => [e.id, e]));
  return {
    available: () => exporters.filter((e) => entitlements.can(e.feature)),
    export(exporterId, document) {
      const exporter = byId.get(exporterId);
      if (!exporter) throw new Error(`Unknown export format "${exporterId}".`);
      entitlements.assert(exporter.feature);
      return exporter.run(document);
    },
  };
}
