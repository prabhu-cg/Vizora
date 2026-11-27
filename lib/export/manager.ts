import type { EntitlementService } from "@/features/entitlements";
import type { VisualisationIR } from "@/types/visualisation";
import { pngExporter, svgExporter } from "./image-exporters";
import { jsonExporter } from "./json-exporter";
import type { ExportArtifact, Exporter } from "./types";

export interface ExportManager {
  /** Exporters the active plan allows and that apply to `document` (all allowed ones when omitted). */
  available(document?: VisualisationIR): Exporter[];
  export(exporterId: string, document: VisualisationIR): Promise<ExportArtifact>;
}

export function createExportManager(
  entitlements: EntitlementService,
  exporters: Exporter[] = [pngExporter, svgExporter, jsonExporter],
): ExportManager {
  const byId = new Map(exporters.map((e) => [e.id, e]));
  return {
    available: (document) => exporters.filter((e) => entitlements.can(e.feature) && (!document || !e.supports || e.supports(document))),
    async export(exporterId, document) {
      const exporter = byId.get(exporterId);
      if (!exporter) throw new Error(`Unknown export format "${exporterId}".`);
      entitlements.assert(exporter.feature);
      if (exporter.supports && !exporter.supports(document)) throw new Error(`${exporter.label} is not available for this kind of visualisation.`);
      return exporter.run(document);
    },
  };
}
