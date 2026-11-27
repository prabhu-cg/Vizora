import { addWidget, emptyDashboard, readChartConfig, readDashboard, recommend } from "@/lib/charts";
import type { Dataset, VisualisationIR, VisualisationSource } from "@/types/visualisation";
import type { SourceInfo } from "./types";

const MAX_DATASETS = 100;

const sourceKind = (s: SourceInfo): VisualisationSource["kind"] => (s.format === "json" ? "json" : s.format === "xlsx" ? "file" : s.format === "paste" ? "text" : "csv");

/** Provenance recorded for a dataset's origin: name, size and a checksum of the untouched original. */
export function toSource(info: SourceInfo): VisualisationSource {
  return { kind: sourceKind(info), name: info.sheet ? `${info.name} (${info.sheet})` : info.name, mimeType: info.mimeType, size: info.size, importedAt: new Date().toISOString(), sha256: info.sha256 };
}

/**
 * Add a dataset to a chart or dashboard. A chart with no configuration yet
 * is given the recommended one, so data becomes a picture straight away.
 */
export function addDataset(doc: VisualisationIR, dataset: Dataset, info?: SourceInfo): VisualisationIR {
  if (doc.data.datasets.length >= MAX_DATASETS) throw new Error(`A visualisation can hold at most ${MAX_DATASETS} datasets.`);
  const next: VisualisationIR = { ...doc, data: { datasets: [...doc.data.datasets, dataset] }, source: info ? toSource(info) : dataset.origin === "manual" ? { kind: "manual" } : doc.source };
  if (doc.type === "chart") {
    const saved = readChartConfig(doc.configuration.options);
    const configured = saved && (saved.x || saved.y.length > 0 || saved.series);
    if (!configured) {
      return { ...next, configuration: { options: { ...doc.configuration.options, chart: { ...recommend(dataset).config, ...(saved ? { kind: saved.kind } : {}) } } } };
    }
  }
  if (doc.type === "dashboard" && readDashboard(doc.configuration.options).widgets.length === 0 && dataset.rows.length > 0) {
    // First data on an empty dashboard: start it off with the recommended chart.
    const { dashboard } = addWidget(emptyDashboard(), { ...recommend(dataset).config, datasetId: dataset.id });
    return { ...next, configuration: { options: { ...doc.configuration.options, dashboard } } };
  }
  return next;
}

export function removeDataset(doc: VisualisationIR, id: string): VisualisationIR {
  return { ...doc, data: { datasets: doc.data.datasets.filter((d) => d.id !== id) } };
}

/** Replace a dataset's contents in place (manual editing), keeping its id so charts stay attached. */
export function replaceDataset(doc: VisualisationIR, dataset: Dataset): VisualisationIR {
  return { ...doc, data: { datasets: doc.data.datasets.map((d) => (d.id === dataset.id ? dataset : d)) } };
}
