import type { ColorKey } from "@/lib/engine/semantics";

/**
 * Exports have no CSS, so colours are literal. Always the light "paper" theme
 * on white so a file reads the same wherever it is opened. Values mirror the
 * Butter tokens (app/tokens.css).
 */
export const EXPORT_THEME = {
  paper: "#ffffff",
  ink: "#353335",
  body: "#4d4a4d",
  muted: "#6b6b6b",
  hairline: "#dccfa6",
  control: "#8a7f6e",
  amber: "#e8b923",
  amberDeep: "#d4a615",
  font: "DM Sans, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  colours: {
    default: "#8a7f6e",
    amber: "#e8b923",
    ink: "#353335",
    blue: "#1f5f9e",
    green: "#146c43",
    red: "#b3261e",
    grey: "#8a7f6e",
  } satisfies Record<ColorKey, string>,
} as const;

/** Blend `hex` toward white by `amount` (0 = hex, 1 = white). */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
