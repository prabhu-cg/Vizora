/**
 * JS mirror of the brand palette in app/tokens.css, for consumers that cannot
 * read CSS variables (ECharts, canvas). tests/unit/design-tokens.test.ts keeps
 * both in sync.
 */
export const brand = {
  navy: "#111827",
  charcoal: "#353535",
  blue: "#2878F0",
  cyan: "#16C7D9",
  violet: "#8055E8",
  orange: "#F5A044",
  white: "#FFFFFF",
  background: "#F7F8FA",
  border: "#E5E7EB",
  muted: "#777777",
} as const;

export const accessible = {
  blueStrong: "#1D63D8",
  mutedText: "#6B6B6B",
  danger: "#B42318",
  success: "#067647",
  orangeText: "#8A4B00",
} as const;

/** Categorical series order for charts: brand hues first. */
export const chartPalette = [
  brand.blue,
  brand.violet,
  brand.cyan,
  brand.orange,
  brand.charcoal,
] as const;
