import { applyFilters, chartTable, datasetOf, resolveChart, runChartQuery } from "@/lib/charts";
import { toCsv } from "@/lib/data";
import type { Dataset, VisualisationIR } from "@/types/visualisation";
import { slugify } from "./slug";
import type { Exporter } from "./types";

const csvBlob = (text: string) => new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }); // BOM so Excel reads UTF-8

export function datasetToCsv(dataset: Pick<Dataset, "columns" | "rows">, rows = dataset.rows): string {
  return toCsv([dataset.columns.map((c) => c.label), ...rows.map((r) => dataset.columns.map((c) => r[c.key] ?? null))]);
}

/** The numbers the chart is actually showing (after filters and aggregation). */
export const csvChartExporter: Exporter = {
  id: "csv-chart",
  label: "Chart data (CSV)",
  description: "The table behind the chart: categories and values as plotted.",
  feature: "export.csv",
  supports: (d) => d.type === "chart" && d.data.datasets.length > 0,
  run(doc) {
    const resolved = resolveChart(doc);
    if (!resolved) throw new Error("Add data first.");
    const result = runChartQuery(resolved.dataset, resolved.config);
    if (!result.ok) throw new Error(result.error);
    const t = chartTable(result.data);
    return { filename: `${slugify(doc.title, "chart")}-chart-data.csv`, blob: csvBlob(toCsv([t.headers, ...t.rows])) };
  },
};

/** The source rows the chart draws from, after its filters, with every column. */
export const csvDatasetExporter: Exporter = {
  id: "csv-dataset",
  label: "Dataset (CSV)",
  description: "The rows behind the chart, with every column, after your filters.",
  feature: "export.csv",
  supports: (d: VisualisationIR) => (d.type === "chart" || d.type === "dashboard") && d.data.datasets.length === 1,
  run(doc) {
    const ds = datasetOf(doc);
    if (!ds) throw new Error("Add data first.");
    const filters = doc.type === "chart" ? (resolveChart(doc)?.config.filters ?? []) : [];
    return { filename: `${slugify(ds.name, "dataset")}.csv`, blob: csvBlob(datasetToCsv(ds, applyFilters(ds, filters))) };
  },
};
