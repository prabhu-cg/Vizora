"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "@/hooks/use-theme";
import type { ChartConfig } from "@/lib/charts";
import type { ChartData } from "@/lib/charts/query";
import { buildEChartsOption } from "./echarts-option";
import { echarts } from "./echarts-setup";
import { readChartTheme } from "./theme";

/** Draws one chart with Apache ECharts. Used by the chart editor and by every dashboard tile. */
export function ChartView({ data, config, label, className }: { data: ChartData; config: ChartConfig; label: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const option = useMemo(() => {
    // `theme` is a dependency on purpose: colours are resolved from CSS tokens when the option is built.
    void theme;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return buildEChartsOption(data, config, readChartTheme(), { decal: true, animate: !reduce });
  }, [data, config, theme]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const chart = echarts.init(el);
    chart.setOption(option, true);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);

  return <div ref={host} role="img" aria-label={label} className={className ?? "size-full"} />;
}
