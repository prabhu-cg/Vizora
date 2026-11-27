"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { runChartQuery, type ChartConfig } from "@/lib/charts";
import type { Dataset } from "@/types/visualisation";
import { ChartView } from "./chart-view";

/** Runs the query for one chart. Shared by the chart editor (which wants the data back) and by dashboard tiles. */
export function useChartQuery(dataset: Dataset | undefined, config: ChartConfig) {
  return useMemo(() => (dataset ? runChartQuery(dataset, config) : undefined), [dataset, config]);
}

/** The chart itself, or plain-language guidance when it cannot be drawn yet. */
export function ChartStage({ dataset, config, label, onAddData, onViewData }: { dataset?: Dataset; config: ChartConfig; label: string; onAddData?: () => void; onViewData?: () => void }) {
  const result = useChartQuery(dataset, config);

  if (!dataset || !result) {
    return (
      <div className="grid h-full place-items-center p-6">
        <EmptyState
          icon={BarChart3}
          title="Add data to see a chart"
          description="Upload a CSV, JSON or Excel file, paste from a spreadsheet, or type your data in. Vizora will recommend a chart that suits it."
          action={onAddData && <Button onClick={onAddData}>Add data</Button>}
        />
      </div>
    );
  }
  if (!result.ok) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div role="alert" className="max-w-md rounded-card border border-border bg-card p-6 text-center">
          <h2 className="font-display text-xl">This chart needs one more choice</h2>
          <p className="mt-2 text-sm text-body">{result.error}</p>
          <p className="mt-2 text-xs text-muted-foreground">Use the settings on the right.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-96 flex-col">
      {/* The chart is centred in a bounded frame: it uses the room but never balloons on a big screen. */}
      <div className="grid min-h-0 flex-1 place-items-center p-3 sm:p-5">
        <div className="h-full max-h-[52rem] w-full max-w-[80rem]">
          <ChartView data={result.data} config={config} label={`${config.kind} chart: ${config.title || label}`} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-4 py-2 text-xs text-muted-foreground">
        <p aria-live="polite">
          {result.data.rowsUsed.toLocaleString()} of {result.data.rowsTotal.toLocaleString()} rows used
          {result.data.notes.length > 0 && <> · {result.data.notes.join(" ")}</>}
        </p>
        {onViewData && (
          <Button variant="ghost" size="sm" onClick={onViewData}>
            <Table2 aria-hidden="true" /> View data
          </Button>
        )}
      </div>
    </div>
  );
}
