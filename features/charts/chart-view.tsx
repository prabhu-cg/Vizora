"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  // Number tiles size their text to the box, so they (and only they) rebuild when it changes.
  const [size, setSize] = useState<{ width: number; height: number }>();
  const sized = config.kind === "kpi";
  const option = useMemo(() => {
    // `theme` is a dependency on purpose: colours are resolved from CSS tokens when the option is built.
    void theme;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return buildEChartsOption(data, config, readChartTheme(), { decal: true, animate: !reduce, size: sized ? size : undefined });
  }, [data, config, theme, sized, size]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const chart = echarts.init(el);
    chart.setOption(option, true);
    const observer = new ResizeObserver(() => {
      chart.resize();
      if (sized) setSize((prev) => { const r = el.getBoundingClientRect(); const next = { width: Math.round(r.width), height: Math.round(r.height) }; return prev && Math.abs(prev.width - next.width) < 4 && Math.abs(prev.height - next.height) < 4 ? prev : next; });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sized` only decides whether to track size
  }, [option]);

  return <div ref={host} role="img" aria-label={label} className={className ?? "size-full"} />;
}
