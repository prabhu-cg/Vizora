import { describe, expect, it } from "vitest";
import { createVisualisation } from "@/lib/visualisation/factory";
import { parseVisualisation } from "@/lib/visualisation/migrations";
describe("clearing a chart setting never makes the document unsaveable", () => {
  it("keys set to undefined (series, limit, bins, axis labels) validate and are dropped", () => {
    const doc = createVisualisation({ title: "t", type: "chart" });
    const withCleared = { ...doc, configuration: { options: { chart: { kind: "pie", x: "Genre", y: ["Year"], series: undefined, limit: undefined, bins: undefined, filters: [], colors: {} } } } };
    const parsed = parseVisualisation(withCleared);
    expect(parsed.configuration.options.chart).toEqual({ kind: "pie", x: "Genre", y: ["Year"], filters: [], colors: {} });
  });
});
