"use client";

import { useMemo, useState } from "react";
import { DataInspector } from "@/features/data/data-inspector";
import { ImportDataDrawer } from "@/features/data/import-drawer";
import type { UpdateOptions } from "@/features/visualisation/use-visualisation-editor";
import { addDataset, type SourceInfo } from "@/lib/data";
import { chartConfigSchema, chartTable, datasetOf, readChartConfig, recommend, runChartQuery, type ChartConfig } from "@/lib/charts";
import { notify } from "@/lib/notify";
import type { Dataset, VisualisationIR } from "@/types/visualisation";
import { ChartConfigPanel, RecommendationCard } from "./chart-config-panel";
import { ChartStage } from "./chart-stage";

type Update = (updater: (d: VisualisationIR) => VisualisationIR, options?: UpdateOptions) => void;

const withChart = (doc: VisualisationIR, chart: ChartConfig): VisualisationIR => ({ ...doc, configuration: { options: { ...doc.configuration.options, chart } } });

/** Centre and right-hand panels for a chart document. (The Data panel sits on the left.) */
export function useChartDocument(doc: VisualisationIR, update: Update) {
  const saved = readChartConfig(doc.configuration.options);
  const dataset = datasetOf(doc, saved?.datasetId);
  const recommendation = useMemo(() => (dataset ? recommend(dataset) : undefined), [dataset]);
  // Until a chart is configured, show the recommendation; the first edit saves it.
  const config: ChartConfig = useMemo(() => {
    const configured = saved && (saved.x || saved.y.length > 0 || saved.series);
    if (configured || !recommendation) return saved ?? chartConfigSchema.parse({});
    return { ...recommendation.config, kind: saved?.kind ?? recommendation.config.kind };
  }, [saved, recommendation]);
  const change = (fn: (c: ChartConfig) => ChartConfig, coalesceKey?: string) =>
    update((d) => {
      const cur = readChartConfig(d.configuration.options);
      const ds = datasetOf(d, cur?.datasetId);
      const base = cur && (cur.x || cur.y.length || cur.series) ? cur : ds ? { ...recommend(ds).config, kind: cur?.kind ?? recommend(ds).config.kind } : (cur ?? chartConfigSchema.parse({}));
      const next = fn({ ...base, datasetId: ds?.id });
      return JSON.stringify(next) === JSON.stringify(cur) ? d : withChart(d, next);
    }, coalesceKey ? { coalesceKey } : undefined);
  return { dataset, config, recommendation, change };
}

export function ChartCentre({ doc, update, onAddData }: { doc: VisualisationIR; update: Update; onAddData: () => void }) {
  const { dataset, config, recommendation } = useChartDocument(doc, update);
  const [inspect, setInspect] = useState(false);
  const result = useMemo(() => (dataset ? runChartQuery(dataset, config) : undefined), [dataset, config]);
  const table = result?.ok ? chartTable(result.data) : undefined;
  return (
    <div className="flex h-full flex-col">
      {recommendation && dataset && (
        <div className="border-b border-border bg-surface px-4 py-2 text-sm text-body">
          <span className="font-semibold text-foreground">{recommendation.kind === config.kind ? "Recommended chart. " : "Your choice. "}</span>
          {recommendation.kind === config.kind ? recommendation.reason : `Vizora would suggest a ${recommendation.kind.replace("-", " ")}: ${recommendation.reason}`}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <ChartStage dataset={dataset} config={config} label={doc.title} onAddData={onAddData} onViewData={() => setInspect(true)} />
      </div>
      <DataInspector dataset={dataset} chartTable={table} open={inspect} onOpenChange={setInspect} />
    </div>
  );
}

export function ChartSettings({ doc, update }: { doc: VisualisationIR; update: Update }) {
  const { dataset, config, recommendation, change } = useChartDocument(doc, update);
  const result = useMemo(() => (dataset ? runChartQuery(dataset, config) : undefined), [dataset, config]);
  if (!dataset) {
    return <p className="p-4 text-sm text-muted-foreground">Chart settings appear here once you add data.</p>;
  }
  return (
    <section aria-label="Chart settings">
      {recommendation && <RecommendationCard recommendation={recommendation} current={config.kind} onPick={(c) => change(() => ({ ...c, datasetId: dataset.id }))} />}
      <ChartConfigPanel
        config={config}
        dataset={dataset}
        datasets={doc.data.datasets}
        data={result?.ok ? result.data : undefined}
        onChange={change}
        onDataset={(id) => change((c) => ({ ...c, datasetId: id, x: undefined, y: [], series: undefined, filters: [] }))}
      />
    </section>
  );
}

/** Adds a dataset and tells the user what the chart did about it. */
export function useAddData(update: Update) {
  return (dataset: Dataset, source?: SourceInfo) => {
    update((d) => addDataset(d, dataset, source));
    notify.success(`Added “${dataset.name}”`, `${dataset.rows.length.toLocaleString()} rows, ${dataset.columns.length} columns`);
  };
}

export { ImportDataDrawer };
