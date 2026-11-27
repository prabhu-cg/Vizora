import { describe, expect, it } from "vitest";
import { buildDataset, readText } from "@/lib/data";
import { recommend, runChartQuery, switchKind, chartConfigSchema, CHART_KINDS } from "@/lib/charts";
import type { Dataset } from "@/types/visualisation";

const ds = (csv: string, name = "data.csv"): Dataset => buildDataset(readText(csv), { name }, () => "d").dataset;
const rows = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i)).join("\n");

const TIME = ds("date,revenue\n" + rows(12, (i) => `2026-${String(i + 1).padStart(2, "0")}-01,${100 + i * 10}`));
const TIME2 = ds("date,revenue,costs\n" + rows(6, (i) => `2026-0${i + 1}-01,${100 + i},${60 + i}`));
const COMPARE = ds("product,sales\n" + rows(9, (i) => `P${i},${10 + i}`));
const SHARE = ds("channel,share\nWeb,50\nShop,30\nPhone,20");
const FEW = ds("team,budget\nA,100\nB,200\nC,300");
const TWO_NUM = ds("height,weight\n" + rows(10, (i) => `${150 + i},${50 + i * 2}`));
const ONE_NUM = ds("score\n" + rows(20, (i) => `${i % 7}`));
const CAT_ONLY = ds("fruit\nApple\nPear\nApple\nPlum\nPear\nApple");
const HIER = ds("country,city,sales\nUK,London,10\nUK,Leeds,5\nFR,Paris,8\nFR,Lyon,4\nDE,Berlin,9\nDE,Munich,6");
const TWO_CAT = ds("region,channel,units\n" + rows(12, (i) => `${["N", "S", "E"][i % 3]},${["web", "shop", "phone", "app"][i % 4]},${((i * 7) % 13) + 20}`));
const WITH_ID = ds("id,city,pop\n" + rows(8, (i) => `${i + 1},C${i},${1000 + i}`));
const ALL = { TIME, TIME2, COMPARE, SHARE, FEW, TWO_NUM, ONE_NUM, CAT_ONLY, HIER, TWO_CAT, WITH_ID };

describe("automatic recommendation", () => {
  it("time series → line, using the date as X", () => {
    const r = recommend(TIME);
    expect(r).toMatchObject({ kind: "line", config: { x: "date", y: ["revenue"] } });
    expect(r.reason).toMatch(/“date” is a date and “revenue” is a number/);
    expect(r.alternatives.map((a) => a.kind)).toEqual(expect.arrayContaining(["area", "bar"]));
  });
  it("time series with several measures → multi-series line", () => {
    expect(recommend(TIME2)).toMatchObject({ kind: "multi-line", config: { x: "date", y: ["revenue", "costs"] } });
  });
  it("category comparison → bar, with horizontal bar offered for many categories", () => {
    const r = recommend(COMPARE);
    expect(r).toMatchObject({ kind: "bar", config: { x: "product", y: ["sales"] } });
    expect(r.reason).toMatch(/compares “sales” across 9 categories/);
    expect(r.alternatives.find((a) => a.kind === "hbar")!.reason).toMatch(/9 categories/);
    expect(r.alternatives.map((a) => a.kind)).not.toContain("pie"); // too many parts for a pie
  });
  it("part-to-whole (few categories, share-like measure) → donut, with pie and bar as alternatives", () => {
    const r = recommend(SHARE);
    expect(r.kind).toBe("donut");
    expect(r.reason).toMatch(/shares of a whole/);
    expect(r.alternatives.map((a) => a.kind)).toEqual(expect.arrayContaining(["bar", "pie"]));
  });
  it("few categories but no sign of shares → still bar, with donut offered as an alternative", () => {
    const r = recommend(FEW);
    expect(r.kind).toBe("bar");
    expect(r.alternatives.map((a) => a.kind)).toEqual(expect.arrayContaining(["donut", "pie"]));
  });
  it("two numeric columns → scatter", () => {
    const r = recommend(TWO_NUM);
    expect(r).toMatchObject({ kind: "scatter", config: { x: "height", y: ["weight"] } });
    expect(r.reason).toMatch(/move together/);
  });
  it("one numeric column → histogram", () => {
    expect(recommend(ONE_NUM)).toMatchObject({ kind: "histogram", config: { x: "score" } });
  });
  it("only categories → count of rows per value", () => {
    const r = recommend(CAT_ONLY);
    expect(r).toMatchObject({ kind: "bar", config: { x: "fruit", aggregation: "count" } });
    expect(r.reason).toMatch(/no numeric columns/);
  });
  it("nested categories with a measure → treemap", () => {
    const r = recommend(HIER);
    expect(r).toMatchObject({ kind: "treemap", config: { x: "country", series: "city", y: ["sales"] } });
    expect(r.reason).toMatch(/belong to one “country”/);
  });
  it("two independent categories → bar, offering stacked bars and a heatmap", () => {
    const kinds = recommend(TWO_CAT).alternatives.map((a) => a.kind);
    expect(kinds).toEqual(expect.arrayContaining(["stacked-bar", "heatmap"]));
  });
  it("ordinary consecutive numbers are data, not ids; a 1..n counter is a row number", () => {
    expect(recommend(TIME2).config.y).toEqual(["revenue", "costs"]);
    const counter = ds("n,city,pop\n" + rows(8, (i) => `${i + 1},C${i},${1000 + i}`));
    expect(recommend(counter).config.y).toEqual(["pop"]);
  });
  it("never treats an id column as a measure", () => {
    const r = recommend(WITH_ID);
    expect(r.config.y).toEqual(["pop"]);
    expect(r.config.x).toBe("city");
  });
  it("an empty dataset gets a gentle message, not a crash", () => {
    const r = recommend({ id: "e", name: "e", columns: [], rows: [] });
    expect(r.reason).toMatch(/no data yet/i);
  });
});

describe("recommendations respect what the user chose", () => {
  it("a date X → line; several measures → multi-line", () => {
    expect(recommend(TIME2, { x: "date", y: ["revenue"] }).kind).toBe("line");
    expect(recommend(TIME2, { x: "date", y: ["revenue", "costs"] }).kind).toBe("multi-line");
  });
  it("numeric X and Y → scatter", () => {
    expect(recommend(TWO_CAT, { x: "units", y: ["units"] }).kind).toBe("scatter");
  });
  it("only X → counts; only a numeric Y → histogram", () => {
    expect(recommend(COMPARE, { x: "product" })).toMatchObject({ kind: "bar", config: { aggregation: "count" } });
    expect(recommend(TWO_NUM, { y: ["height"] }).kind).toBe("histogram");
  });
  it("a Series column → stacked bar", () => {
    expect(recommend(TWO_CAT, { x: "region", y: ["units"], series: "channel" }).kind).toBe("stacked-bar");
  });
});

describe("every recommendation is usable", () => {
  for (const [name, d] of Object.entries(ALL)) {
    it(`${name}: the recommendation and all alternatives draw without errors`, () => {
      const r = recommend(d);
      for (const s of [r, ...r.alternatives]) {
        const out = runChartQuery(d, s.config);
        expect(out.ok, `${name}/${s.kind}: ${out.ok ? "" : out.error}`).toBe(true);
        expect(s.reason.length).toBeGreaterThan(10);
      }
    });
    it(`${name}: is deterministic`, () => {
      expect(JSON.stringify(recommend(d))).toBe(JSON.stringify(recommend(d)));
    });
  }
  it("the configuration attached to every suggestion draws the chart it names", () => {
    for (const [name, d] of Object.entries(ALL)) {
      const r = recommend(d);
      expect(r.config.kind, `${name} recommendation`).toBe(r.kind);
      for (const a of r.alternatives) expect(a.config.kind, `${name}/${a.kind}`).toBe(a.kind);
    }
    for (const sel of [{ x: "date", y: ["revenue"] }, { x: "date", y: ["revenue", "costs"] }, { y: ["revenue"] }, { x: "date" }]) {
      const r = recommend(TIME2, sel);
      expect(r.config.kind).toBe(r.kind);
    }
  });
  it("alternatives are distinct kinds and never repeat the recommendation", () => {
    for (const d of Object.values(ALL)) {
      const r = recommend(d);
      const kinds = r.alternatives.map((a) => a.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
      expect(kinds).not.toContain(r.kind);
    }
  });
});

describe("switching kind", () => {
  it("pie and donut keep one measure and drop the series", () => {
    const c = chartConfigSchema.parse({ kind: "grouped-bar", x: "a", y: ["m1", "m2"], series: "s" });
    expect(switchKind(c, "pie")).toMatchObject({ kind: "pie", y: ["m1"], series: undefined });
  });
  it("histogram needs no measure", () => {
    expect(switchKind(chartConfigSchema.parse({ x: "n", y: ["m"] }), "histogram").y).toEqual([]);
  });
  it("covers every chart kind", () => {
    expect(CHART_KINDS).toHaveLength(19);
    for (const k of CHART_KINDS) expect(switchKind(chartConfigSchema.parse({}), k).kind).toBe(k);
  });
});
