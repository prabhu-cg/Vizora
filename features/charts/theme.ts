import { CHART_VARS } from "@/lib/design/tokens";
import { PALETTES, type ChartConfig } from "@/lib/charts";

export interface ChartTheme {
  series: string[];
  text: string;
  muted: string;
  grid: string;
  surface: string;
  /** Lightest step of the heatmap ramp. */
  heatLow: string;
  /** Label colours for text drawn on coloured shapes. */
  labelOnLight: string;
  labelOnDark: string;
}

/** Light-theme values; used by tests, SSR and exports (which are always light, on white). */
export const FALLBACK_CHART_THEME: ChartTheme = {
  series: ["#e8b923", "#353335", "#1f5f9e", "#146c43", "#8a7f6e"],
  text: "#4d4a4d",
  muted: "#6b6b6b",
  grid: "#ece5cc",
  surface: "#ffffff",
  heatLow: "#faf4df",
  labelOnLight: "#353335",
  labelOnDark: "#ffffff",
};

/** Resolve the active theme's chart colours from the CSS tokens (ECharts cannot read variables). */
export function readChartTheme(el: Element = document.documentElement): ChartTheme {
  const css = getComputedStyle(el);
  const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    series: CHART_VARS.map((v, i) => get(v, FALLBACK_CHART_THEME.series[i]!)),
    text: get("--body", FALLBACK_CHART_THEME.text),
    muted: get("--muted-foreground", FALLBACK_CHART_THEME.muted),
    grid: get("--border", FALLBACK_CHART_THEME.grid),
    surface: get("--card", FALLBACK_CHART_THEME.surface),
    heatLow: get("--primary-soft", FALLBACK_CHART_THEME.heatLow),
    labelOnLight: FALLBACK_CHART_THEME.labelOnLight,
    labelOnDark: FALLBACK_CHART_THEME.labelOnDark,
  };
}

/** Pick dark or light text for a fill colour by its brightness (WCAG relative luminance). */
export function readableOn(fill: string, theme: ChartTheme): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(fill.trim());
  if (!m) return theme.labelOnDark;
  const n = parseInt(m[1]!, 16);
  const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? theme.labelOnLight : theme.labelOnDark;
}

/** Colour for each series or category: your override, else the chosen palette. */
export function colourFor(names: readonly string[], config: Pick<ChartConfig, "palette" | "colors">, theme: ChartTheme): string[] {
  const palette = PALETTES[config.palette]?.colors ?? theme.series;
  return names.map((n, i) => config.colors[n] ?? palette[i % palette.length]!);
}
