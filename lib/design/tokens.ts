/**
 * JS mirror of the Butter tokens in app/tokens.css, for what cannot read CSS
 * variables at build time. tests/unit/design-tokens.test.ts keeps both in sync.
 * Components must use Tailwind semantic classes; they never import these hex values.
 */
export const light = {
  primary: "#e8b923",
  primaryHover: "#d4a615",
  primaryForeground: "#353335",
  primaryText: "#826400",
  primarySoft: "#faf4df",
  background: "#ffffff",
  surface: "#fcfaf3",
  muted: "#f8f4e4",
  foreground: "#353335",
  body: "#4d4a4d",
  mutedForeground: "#6b6b6b",
  border: "#ece5cc",
  input: "#8a7f6e",
  success: "#146c43",
  warning: "#8a5a00",
  info: "#1f5f9e",
  destructive: "#b3261e",
} as const;

export const dark = {
  primaryText: "#f0c94a",
  primarySoft: "#2a2410",
  background: "#141312",
  card: "#1c1b19",
  surface: "#181716",
  muted: "#262420",
  foreground: "#faf8f2",
  body: "#e6e2da",
  mutedForeground: "#a8a399",
  border: "#2e2b26",
  input: "#8a7f6e",
  success: "#5cc48b",
  warning: "#e0a84a",
  info: "#7db3e8",
  destructive: "#f2827a",
} as const;

export const CHART_VARS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"] as const;
