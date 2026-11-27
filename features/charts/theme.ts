import { CHART_VARS } from "@/lib/design/tokens";

export interface ChartTheme {
  series: string[];
  text: string;
  grid: string;
}

/** Light-theme fallback; used by tests and SSR. */
export const FALLBACK_CHART_THEME: ChartTheme = {
  series: ["#e8b923", "#353335", "#1f5f9e", "#146c43", "#8a7f6e"],
  text: "#4d4a4d",
  grid: "#ece5cc",
};

/** Resolve the active theme's chart colours from the CSS tokens (ECharts cannot read variables). */
export function readChartTheme(el: Element = document.documentElement): ChartTheme {
  const css = getComputedStyle(el);
  const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    series: CHART_VARS.map((v, i) => get(v, FALLBACK_CHART_THEME.series[i]!)),
    text: get("--body", FALLBACK_CHART_THEME.text),
    grid: get("--border", FALLBACK_CHART_THEME.grid),
  };
}
