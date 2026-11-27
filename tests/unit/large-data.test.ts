import { describe, expect, it } from "vitest";
import { buildEChartsOption } from "@/features/charts/echarts-option";
import { chartConfigSchema, recommend, runChartQuery } from "@/lib/charts";
import { buildDataset, readText } from "@/lib/data";

const csv = (n: number, row: (i: number) => string, head: string) => buildDataset(readText([head, ...Array.from({ length: n }, (_, i) => row(i))].join("\n")), {}, () => "d").dataset;

describe("large categorical data", () => {
  const D = csv(2000, (i) => `item${i},${i + 1}`, "name,n");
  it("is limited automatically, keeps the largest, and says so", () => {
    const r = runChartQuery(D, chartConfigSchema.parse({ kind: "pie", x: "name", y: ["n"] }));
    if (!r.ok) throw new Error(r.error);
    expect(r.data.categories).toHaveLength(30);
    expect(r.data.categories[0]).toBe("item1999");
    expect(r.data.notes.join(" ")).toMatch(/largest 30 of 2,000 categories/);
  });
  it("an explicit limit wins, and small data is untouched", () => {
    const r = runChartQuery(D, chartConfigSchema.parse({ kind: "pie", x: "name", y: ["n"], limit: 5 }));
    if (!r.ok) throw new Error(r.error);
    expect(r.data.categories).toHaveLength(5);
    const small = runChartQuery(csv(10, (i) => `a${i},${i}`, "name,n"), chartConfigSchema.parse({ kind: "pie", x: "name", y: ["n"] }));
    if (!small.ok) throw new Error(small.error);
    expect(small.data.notes.join(" ")).not.toMatch(/readable/);
  });
  it("turns off patterns and animation when there are hundreds of marks", () => {
    const config = chartConfigSchema.parse({ kind: "bar", x: "name", y: ["n"], limit: 500 });
    const r = runChartQuery(D, config);
    if (!r.ok) throw new Error(r.error);
    const o = buildEChartsOption(r.data, config, undefined as never, { decal: true, animate: true }) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(o.animation).toBe(false);
    expect(o.aria.decal.show).toBe(false);
  });
});

describe("recommendations for realistic data", () => {
  const rows = (i: number) => `2015-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")},${10000 + (i % 300)},${i % 5},${i * 3}`;
  const D = csv(3000, (i) => `${new Date(Date.UTC(2010, 0, 1 + i)).toISOString().slice(0, 10)},${10000 + (i % 300)},${i % 5},${i * 3}`, "Since,Zipcode,Beds,Price");
  void rows;
  it("groups many dates by month or year, and does not plot zip codes", () => {
    const rec = recommend(D);
    expect(rec.config.y).not.toContain("Zipcode");
    expect(rec.config.timeBucket).not.toBe("none");
    expect(rec.reason).toMatch(/grouped by (month|year)/);
    const r = runChartQuery(D, rec.config);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.categories.length).toBeLessThan(200);
  });
});
