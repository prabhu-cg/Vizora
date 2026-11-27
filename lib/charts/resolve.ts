import type { Dataset, VisualisationIR } from "@/types/visualisation";
import { readChartConfig, type ChartConfig } from "./config";
import { recommend } from "./recommend";

export const datasetOf = (doc: Pick<VisualisationIR, "data">, id?: string): Dataset | undefined => doc.data.datasets.find((d) => d.id === id) ?? doc.data.datasets[0];

/** The dataset and configuration a chart document draws, falling back to the recommendation when none is saved. */
export function resolveChart(doc: Pick<VisualisationIR, "data" | "configuration">): { dataset: Dataset; config: ChartConfig } | undefined {
  const saved = readChartConfig(doc.configuration.options);
  const dataset = datasetOf(doc, saved?.datasetId);
  if (!dataset) return undefined;
  const config = saved && (saved.x || saved.y.length || saved.series) ? { ...saved, datasetId: dataset.id } : { ...recommend(dataset).config, ...(saved ? { kind: saved.kind } : {}) };
  return { dataset, config };
}
