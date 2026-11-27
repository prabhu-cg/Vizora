import { describe, expect, it } from "vitest";
import { SUPPORT_NOTES, detectSupport } from "@/lib/compat";

describe("browser support detection", () => {
  it("reports everything in a capable browser", () => {
    const g = { indexedDB: {}, File: class {}, FileReader: class {}, Blob: class {}, URL: { createObjectURL: () => "" }, crypto: { subtle: {} }, Worker: class {}, navigator: { clipboard: { writeText: () => undefined } } };
    expect(Object.values(detectSupport(g as never)).every(Boolean)).toBe(true);
  });
  it("flags each missing capability separately", () => {
    const s = detectSupport({ navigator: {} } as never);
    expect(Object.values(s).some(Boolean)).toBe(false);
    for (const k of Object.keys(s)) expect(SUPPORT_NOTES[k as keyof typeof s].without.length).toBeGreaterThan(10);
  });
  it("this test environment supports saving and files", () => {
    expect(detectSupport()).toMatchObject({ files: true });
  });
});
