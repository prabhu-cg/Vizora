import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");
const tokens = readFileSync("app/tokens.css", "utf8");
const rule = (name: string) => css.match(new RegExp(`@keyframes ${name} \\{[^\\n]*\\}`))?.[0] ?? "";

describe("overlay animations", () => {
  it("the dialog pop animates scale and opacity only: centring uses `translate`, so a transform here would double the offset and make it jump", () => {
    for (const k of ["vz-pop-in", "vz-pop-out"]) {
      expect(rule(k), k).not.toBe("");
      expect(rule(k), k).not.toMatch(/transform/);
      expect(rule(k), k).toMatch(/scale/);
    }
  });
  it("things that close keep their final frame until they are removed, so nothing flashes back", () => {
    for (const sel of ["vz-drawer", "vz-scrim", "vz-dialog", "vz-menu"]) {
      expect(css, sel).toMatch(new RegExp(`\\.${sel}\\[data-state="closed"\\][^}]*forwards`));
    }
  });
  it("every overlay has both an enter and an exit, and the exit is quicker", () => {
    expect(tokens).toMatch(/--duration-in: 220ms/);
    expect(tokens).toMatch(/--duration-out: 180ms/);
    for (const sel of ["vz-drawer", "vz-scrim", "vz-dialog", "vz-menu"]) {
      expect(css).toMatch(new RegExp(`\\.${sel}\\[data-state="open"\\]\\s*\\{\\s*animation`));
    }
  });
  it("reduced motion switches all of it off", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation-duration: 0\.01ms !important/);
  });
});
