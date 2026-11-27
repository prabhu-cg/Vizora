import { describe, expect, it } from "vitest";
import { buildChartOption, chartKindOf, selectChartData } from "@/features/charts/option";
import { addDatasetToVisualisation } from "@/features/data-import";
import { ingest } from "@/lib/parsers";
import { createVisualisation } from "@/lib/visualisation/factory";

const withCsv = (csv: string) =>
  addDatasetToVisualisation(createVisualisation({ title: "C", type: "chart" }), ingest({ name: "d.csv", text: csv }));

describe("IR → ECharts option", () => {
  it("returns undefined when there is nothing chartable", () => {
    expect(buildChartOption(createVisualisation({ title: "C", type: "chart" }))).toBeUndefined();
    expect(buildChartOption(withCsv("a,b\nx,y"))).toBeUndefined();
  });

  it("maps a label column and numeric columns to categories and series", () => {
    const doc = withCsv("Month,Sales,Costs\nJan,10,4\nFeb,12,5");
    expect(selectChartData(doc)).toMatchObject({ categoryKey: "Month", valueKeys: ["Sales", "Costs"] });
    const option = buildChartOption(doc) as { xAxis: { data: string[] }; series: { name: string; type: string; data: number[] }[] };
    expect(option.xAxis.data).toEqual(["Jan", "Feb"]);
    expect(option.series.map((s) => [s.name, s.type, s.data])).toEqual([
      ["Sales", "bar", [10, 12]],
      ["Costs", "bar", [4, 5]],
    ]);
  });

  it("honours the persisted chart kind", () => {
    const doc = withCsv("m,v\na,1");
    const line = { ...doc, configuration: { options: { chartKind: "line" } } };
    expect(chartKindOf(line)).toBe("line");
    expect((buildChartOption(line) as { series: { type: string }[] }).series[0]!.type).toBe("line");
  });
});
