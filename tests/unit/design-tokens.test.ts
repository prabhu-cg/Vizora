import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { accessible, brand } from "@/lib/design/tokens";

const css = readFileSync(resolve(process.cwd(), "app/tokens.css"), "utf8");

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("design tokens", () => {
  it("TS palette mirrors the CSS custom properties", () => {
    const pairs: [string, string][] = [
      ["--vz-navy", brand.navy], ["--vz-charcoal", brand.charcoal], ["--vz-blue", brand.blue],
      ["--vz-cyan", brand.cyan], ["--vz-violet", brand.violet], ["--vz-orange", brand.orange],
      ["--vz-white", brand.white], ["--vz-bg", brand.background], ["--vz-border", brand.border],
      ["--vz-muted", brand.muted], ["--vz-blue-strong", accessible.blueStrong],
      ["--vz-muted-text", accessible.mutedText], ["--vz-danger", accessible.danger],
      ["--input", "#858B95"], ["--vz-success", accessible.success], ["--vz-orange-text", accessible.orangeText],
    ];
    for (const [name, hex] of pairs) {
      const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
      expect(m, name).not.toBeNull();
      expect(m![1]!.toLowerCase(), name).toBe(hex.toLowerCase());
    }
  });

  it("uses the specified brand colours exactly", () => {
    expect(brand).toMatchObject({
      navy: "#111827", charcoal: "#353535", blue: "#2878F0", cyan: "#16C7D9", violet: "#8055E8",
      orange: "#F5A044", white: "#FFFFFF", background: "#F7F8FA", border: "#E5E7EB", muted: "#777777",
    });
  });

  // WCAG 2.2 AA: 4.5:1 for normal text, 3:1 for large text and UI components.
  it.each([
    ["body text (navy on background)", brand.navy, brand.background, 4.5],
    ["body text (charcoal on white)", brand.charcoal, brand.white, 4.5],
    ["muted text on white", accessible.mutedText, brand.white, 4.5],
    ["muted text on page background", accessible.mutedText, brand.background, 4.5],
    ["primary button label", brand.white, accessible.blueStrong, 4.5],
    ["link/primary text on white", accessible.blueStrong, brand.white, 4.5],
    ["link/primary text on soft blue", accessible.blueStrong, "#EAF1FE", 4.5],
    ["danger text on white", accessible.danger, brand.white, 4.5],
    ["danger text on danger-soft", accessible.danger, "#FEF0EE", 4.5],
    ["success text on white", accessible.success, brand.white, 4.5],
    ["warning text on orange-soft", accessible.orangeText, "#FEF3E4", 4.5],
    ["violet text on white", brand.violet, brand.white, 4.5],
    ["cyan hero label on navy", brand.cyan, brand.navy, 4.5],
    ["focus ring (brand blue) on white", brand.blue, brand.white, 3],
    ["focus ring (brand blue) on background", brand.blue, brand.background, 3],
    ["form control border on white (1.4.11)", "#858B95", brand.white, 3],
    ["form control border on page background (1.4.11)", "#858B95", brand.background, 3],
  ])("%s meets its WCAG contrast minimum", (_name, fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it("documents why raw Blue and Muted are not used for small text", () => {
    expect(contrast(brand.blue, brand.white)).toBeLessThan(4.5);
    expect(contrast(brand.muted, brand.background)).toBeLessThan(4.5);
  });
});
