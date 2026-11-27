"use client";

import { LayoutDashboard, Plus } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChartConfigPanel, RecommendationCard } from "@/features/charts/chart-config-panel";
import { useChartQuery } from "@/features/charts/chart-stage";
import type { UpdateOptions } from "@/features/visualisation/use-visualisation-editor";
import {
  GRID_COLUMNS, MAX_H, MAX_WIDGETS, MIN_H, MIN_W, addWidget, datasetOf, duplicateWidget, kpiConfigFor, readDashboard, recommend, removeWidget, resizeWidget, moveWidget,
  updateWidgetChart, type ChartConfig, type Dashboard,
} from "@/lib/charts";
import type { VisualisationIR } from "@/types/visualisation";
import { DashboardCanvas } from "./dashboard-canvas";

type Update = (updater: (d: VisualisationIR) => VisualisationIR, options?: UpdateOptions) => void;
const setDashboard = (doc: VisualisationIR, dashboard: Dashboard): VisualisationIR => ({ ...doc, configuration: { options: { ...doc.configuration.options, dashboard } } });

export function useDashboard(doc: VisualisationIR, update: Update) {
  const dashboard = useMemo(() => readDashboard(doc.configuration.options), [doc.configuration.options]);
  const [selectedId, setSelected] = useState<string>();
  const selected = dashboard.widgets.find((w) => w.id === selectedId);
  const change = useCallback((fn: (d: Dashboard) => Dashboard, coalesceKey?: string) => {
    update((d) => {
      const cur = readDashboard(d.configuration.options);
      const next = fn(cur);
      return next === cur ? d : setDashboard(d, next);
    }, coalesceKey ? { coalesceKey } : undefined);
  }, [update]);
  return { dashboard, selected, selectedId: selected?.id, setSelected, change };
}
export type DashboardState = ReturnType<typeof useDashboard>;

/** The grid and its toolbar (centre panel). */
export function DashboardCentre({ doc, state }: { doc: VisualisationIR; state: DashboardState }) {
  const { dashboard, selectedId, setSelected, change } = state;
  const id = useId();
  const [datasetId, setDatasetId] = useState<string>();
  const [removing, setRemoving] = useState<string>();
  const datasets = doc.data.datasets;
  const chosen = datasetOf(doc, datasetId);

  const add = () => {
    if (!chosen) return;
    let newId = "";
    change((d) => {
      const r = addWidget(d, { ...recommend(chosen).config, datasetId: chosen.id });
      newId = r.id;
      return r.dashboard;
    });
    queueMicrotask(() => newId && setSelected(newId));
  };

  const addTile = () => {
    if (!chosen) return;
    let newId = "";
    change((d) => {
      const r = addWidget(d, kpiConfigFor(chosen), { w: 3, h: 2 });
      newId = r.id;
      return r.dashboard;
    });
    queueMicrotask(() => newId && setSelected(newId));
  };

  return (
    <div className="flex h-full flex-col">
      <div role="toolbar" aria-label="Dashboard tools" className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        {datasets.length > 1 && (
          <>
            <Label htmlFor={`${id}-ds`} className="sr-only">Dataset for the new chart</Label>
            <Select id={`${id}-ds`} className="h-9 w-auto text-sm" value={chosen?.id ?? ""} onChange={(e) => setDatasetId(e.target.value)}>
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </>
        )}
        <Button size="sm" onClick={add} disabled={!chosen || dashboard.widgets.length >= MAX_WIDGETS}>
          <Plus aria-hidden="true" /> Add chart
        </Button>
        <Button size="sm" variant="outline" onClick={addTile} disabled={!chosen || dashboard.widgets.length >= MAX_WIDGETS}>
          <Plus aria-hidden="true" /> Add number tile
        </Button>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {!chosen ? "Add data first, then add charts." : dashboard.widgets.length >= MAX_WIDGETS ? `A dashboard holds up to ${MAX_WIDGETS} charts.` : `${dashboard.widgets.length} chart${dashboard.widgets.length === 1 ? "" : "s"}. Drag by the handle, resize from the corner, or use the arrow keys.`}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {dashboard.widgets.length === 0 ? (
          <div className="grid h-full min-h-80 place-items-center p-6">
            <EmptyState
              icon={LayoutDashboard}
              title="This dashboard is empty"
              description={chosen ? "Add a chart. Vizora starts with the one it recommends for your data." : "Add some data from the Data panel, and Vizora will start the dashboard with a recommended chart."}
              action={chosen && <Button onClick={add}><Plus aria-hidden="true" /> Add chart</Button>}
            />
          </div>
        ) : (
          <DashboardCanvas
            doc={doc}
            dashboard={dashboard}
            selectedId={selectedId}
            onSelect={setSelected}
            onChange={change}
            onDelete={setRemoving}
            onDuplicate={(wid) => {
              let newId = "";
              change((d) => {
                const r = duplicateWidget(d, wid);
                newId = r.id;
                return r.dashboard;
              });
              queueMicrotask(() => newId && setSelected(newId));
            }}
          />
        )}
      </div>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(undefined)}
        title="Delete this chart?"
        description="It is removed from the dashboard. Your data is not affected, and you can undo this."
        confirmLabel="Delete chart"
        onConfirm={async () => {
          if (removing) {
            change((d) => removeWidget(d, removing));
            if (removing === selectedId) setSelected(undefined);
          }
        }}
      />
    </div>
  );
}

/** Settings for the selected chart: its place on the grid and every chart option. */
export function WidgetSettings({ doc, state }: { doc: VisualisationIR; state: DashboardState }) {
  const { selected, change } = state;
  const id = useId();
  const dataset = selected ? datasetOf(doc, selected.chart.datasetId) : undefined;
  const result = useChartQuery(dataset, selected?.chart ?? ({} as ChartConfig));
  const recommendation = useMemo(() => (dataset ? recommend(dataset) : undefined), [dataset]);
  if (!selected) return null;
  const wid = selected.id;
  const chartChange = (fn: (c: ChartConfig) => ChartConfig, coalesceKey?: string) => change((d) => updateWidgetChart(d, wid, fn), coalesceKey ?? `widget:${wid}`);
  const num = (label: string, field: "x" | "y" | "w" | "h", min: number, max: number, show: number) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`${id}-${field}`}>{label}</Label>
      <Input id={`${id}-${field}`} type="number" min={min} max={max} value={show} className="h-9" onChange={(e) => {
        const v = Math.round(Number(e.target.value));
        if (!Number.isFinite(v)) return;
        change((d) => (field === "x" ? moveWidget(d, wid, v - 1, selected.y) : field === "y" ? moveWidget(d, wid, selected.x, v - 1) : field === "w" ? resizeWidget(d, wid, v, selected.h) : resizeWidget(d, wid, selected.w, v)), `grid:${wid}`);
      }} />
    </div>
  );
  return (
    <section aria-label="Selected chart settings">
      <div className="grid gap-3 border-b border-border p-4">
        <h3 className="text-[15px] font-semibold">Position and size</h3>
        <div className="grid grid-cols-2 gap-3">
          {num("Column", "x", 1, GRID_COLUMNS, selected.x + 1)}
          {num("Row", "y", 1, 200, selected.y + 1)}
          {num("Width (columns)", "w", MIN_W, GRID_COLUMNS, selected.w)}
          {num("Height (rows)", "h", MIN_H, MAX_H, selected.h)}
        </div>
        <p className="text-xs text-muted-foreground">The grid has {GRID_COLUMNS} columns. Other charts move aside to make room.</p>
      </div>
      {recommendation && dataset && <RecommendationCard recommendation={recommendation} current={selected.chart.kind} onPick={(c) => chartChange(() => ({ ...c, datasetId: dataset.id }))} />}
      <ChartConfigPanel
        config={selected.chart}
        dataset={dataset}
        datasets={doc.data.datasets}
        data={result?.ok ? result.data : undefined}
        onChange={chartChange}
        onDataset={(dsId) => chartChange((c) => ({ ...c, datasetId: dsId, x: undefined, y: [], series: undefined, filters: [] }))}
      />
    </section>
  );
}
