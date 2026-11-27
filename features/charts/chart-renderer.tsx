"use client";

import { BarChart, LineChart } from "echarts/charts";
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart3 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import type { RendererProps } from "@/components/visualisations/registry";
import { Button } from "@/components/ui/button";
import { buildChartOption, chartKindOf, type ChartKind } from "./option";

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, AriaComponent, CanvasRenderer]);

export default function ChartRenderer({ document: doc, onChange }: RendererProps) {
  const host = useRef<HTMLDivElement>(null);
  const { data, configuration } = doc;
  const option = useMemo(() => buildChartOption({ data, configuration }), [data, configuration]);
  const kind = chartKindOf({ data, configuration });

  useEffect(() => {
    const el = host.current;
    if (!el || !option) return;
    const chart = echarts.init(el);
    chart.setOption(option);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);

  const setKind = (next: ChartKind) =>
    onChange((d) => (chartKindOf(d) === next ? d : { ...d, configuration: { options: { ...d.configuration.options, chartKind: next } } }));

  if (!option) {
    return (
      <div className="grid h-full place-items-center p-6">
        <EmptyState
          icon={BarChart3}
          title="No chartable data yet"
          description="Import a CSV or JSON file from the Data panel. A chart needs one label column and at least one numeric column."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-96 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2" role="group" aria-label="Chart type">
        {(["bar", "line"] as const).map((k) => (
          <Button key={k} size="sm" variant={kind === k ? "primary" : "secondary"} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k === "bar" ? "Bar" : "Line"}
          </Button>
        ))}
      </div>
      <div ref={host} className="min-h-0 flex-1" role="img" aria-label={`${kind} chart of ${doc.title}`} />
    </div>
  );
}
