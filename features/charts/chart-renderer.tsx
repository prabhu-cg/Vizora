"use client";

import { BarChart, LineChart } from "echarts/charts";
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { LegacyGridContainLabel } from "echarts/features";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart3 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import type { RendererProps } from "@/components/visualisations/registry";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { buildChartOption, chartKindOf, type ChartKind } from "./option";
import { readChartTheme } from "./theme";

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, AriaComponent, LegacyGridContainLabel, CanvasRenderer]);

export default function ChartRenderer({ document: doc, onChange }: RendererProps) {
  const host = useRef<HTMLDivElement>(null);
  const { data, configuration } = doc;
  const { theme } = useTheme();
  // `theme` is a dependency on purpose: colours are resolved from CSS tokens at build time of the option.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const option = useMemo(() => buildChartOption({ data, configuration }, readChartTheme()), [data, configuration, theme]);
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
          <Button key={k} size="sm" variant={kind === k ? "primary" : "outline"} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k === "bar" ? "Bar" : "Line"}
          </Button>
        ))}
      </div>
      <div ref={host} className="min-h-0 flex-1" role="img" aria-label={`${kind} chart of ${doc.title}`} />
    </div>
  );
}
