import { nowIso } from "@/lib/utils/time";
import type { IngestResult } from "@/types/data";
import type { VisualisationIR } from "@/types/visualisation";

const MAX_DATASETS = 100;

/** Pure: attach an ingested dataset to a visualisation and record its provenance. */
export function addDatasetToVisualisation(doc: VisualisationIR, result: IngestResult): VisualisationIR {
  if (doc.data.datasets.length >= MAX_DATASETS) {
    throw new Error(`A visualisation can hold at most ${MAX_DATASETS} datasets.`);
  }
  return {
    ...doc,
    data: { datasets: [...doc.data.datasets, result.dataset] },
    source: {
      kind: result.source.kind,
      name: result.source.name,
      mimeType: result.source.mimeType,
      size: result.source.size,
      importedAt: nowIso(),
    },
  };
}

export function removeDataset(doc: VisualisationIR, datasetId: string): VisualisationIR {
  return { ...doc, data: { datasets: doc.data.datasets.filter((d) => d.id !== datasetId) } };
}
