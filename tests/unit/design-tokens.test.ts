import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { dark, light } from "@/lib/design/tokens";

const root = process.cwd();
const css = readFileSync(resolve(root, "app/tokens.css"), "utf8");
const [lightCss, darkCss = ""] = css.split(/^\.dark\s*\{/m);

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
const camelToKebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const cssVar = (block: string, name: string) => block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();

describe("Butter tokens", () => {
  it("TS mirror matches the CSS custom properties (light and dark)", () => {
    for (const [key, hex] of Object.entries(light)) expect(cssVar(lightCss!, camelToKebab(key)), `light ${key}`).toBe(hex);
    for (const [key, hex] of Object.entries(dark)) expect(cssVar(darkCss, camelToKebab(key)), `dark ${key}`).toBe(hex);
  });

  it("uses the specified Butter values", () => {
    expect(light).toMatchObject({ primary: "#e8b923", primaryHover: "#d4a615", primaryText: "#826400", primarySoft: "#faf4df", surface: "#fcfaf3", muted: "#f8f4e4", border: "#ece5cc" });
  });

  // WCAG 2.2 AA: 4.5:1 normal text; 3:1 large text and UI component boundaries.
  const pairs = (t: Record<string, string>, extra: Record<string, string>) => {
    const c = { ...t, ...extra } as Record<string, string>;
    return [
      ["body on paper", c.body, c.background, 4.5],
      ["body on desk", c.body, c.surface, 4.5],
      ["ink strong on paper", c.foreground, c.background, 4.5],
      ["muted text on paper", c.mutedForeground, c.background, 4.5],
      ["muted text on desk", c.mutedForeground, c.surface, 4.5],
      ["muted text on sand", c.mutedForeground, c.muted, 4.5],
      ["ochre text on paper", c.primaryText, c.background, 4.5],
      ["ochre text on butter tint", c.primaryText, c.primarySoft, 4.5],
      ["ochre text on desk", c.primaryText, c.surface, 4.5],
      ["success on paper", c.success, c.background, 4.5],
      ["warning on paper", c.warning, c.background, 4.5],
      ["info on paper", c.info, c.background, 4.5],
      ["destructive on paper", c.destructive, c.background, 4.5],
      ["control border on paper (1.4.11)", c.input, c.background, 3],
      ["control border on desk (1.4.11)", c.input, c.surface, 3],
    ] as const;
  };
  it.each(pairs(light, {}))("light: %s", (_n, fg, bg, min) => expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min));
  it.each(pairs(dark, { card: dark.card }))("dark: %s", (_n, fg, bg, min) => expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min));

  it("charcoal text on the amber fill passes AA; white on amber would not", () => {
    expect(contrast(light.primaryForeground, light.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.primaryForeground, light.primaryHover)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", light.primary)).toBeLessThan(3);
  });
});

describe("Token Only Rule", () => {
  const exempt = new Set(["components/brand/logo.tsx", "app/global-error.tsx", "app/icon.svg", "app/opengraph-image.tsx", "features/charts/svg.ts"]); // no CSS available: social card and exported images
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(name) ? [p] : [];
    });
  }
  it("components and routes contain no literal hex colours or bg-white/text-white", () => {
    const offenders: string[] = [];
    for (const dir of ["components", "app", "features"]) {
      for (const file of walk(resolve(root, dir))) {
        const rel = file.slice(root.length + 1);
        if (exempt.has(rel) || rel === "app/tokens.css") continue;
        const text = readFileSync(file, "utf8");
        if (rel === "app/layout.tsx" || rel === "features/charts/theme.ts") continue; // theme-color meta / chart fallback
        if (/#[0-9a-fA-F]{6}\b|\b(bg|text)-white\b/.test(text)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
