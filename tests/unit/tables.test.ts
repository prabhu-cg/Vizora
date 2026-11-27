import { describe, expect, it } from "vitest";
import { createEntitlementService } from "@/features/entitlements";
import { buildDataset, readText } from "@/lib/data";
import { createExportManager, renderSvgFor } from "@/lib/export";
import { TABLE_IMAGE_MAX_COLUMNS, TABLE_IMAGE_MAX_ROWS, renderTableSvg } from "@/lib/export/table-svg";
import { buildTableView, defaultTableConfig, fraction, moveColumn, readTableConfig, sortRows, tableConfigSchema, toggleColumn, withTable, type TableConfig } from "@/lib/tables";
import { parseVisualisation } from "@/lib/visualisation/migrations";
import { createVisualisation } from "@/lib/visualisation/factory";
import type { VisualisationIR } from "@/types/visualisation";

const ds = (csv: string) => buildDataset(readText(csv), {}, () => "d").dataset;
const cfg = (c: Partial<TableConfig> = {}) => tableConfigSchema.parse(c);
const D = ds("name,team,score,joined\nAda,Eng,90,2024-03-01\nBo,Ops,45,2023-01-15\nCy,Eng,,2025-06-30\nDi,Ops,70,2022-11-02");
const col = (k: string) => D.columns.find((c) => c.key === k)!;
const names = (rows: { name?: unknown }[]) => rows.map((r) => r.name);
const docWith = (dataset: typeof D, table: Partial<TableConfig> = {}): VisualisationIR => withTable({ ...createVisualisation({ title: "Team", type: "table" }), data: { datasets: [dataset] } }, cfg(table));

describe("table view", () => {
  it("shows every column and row by default", () => {
    const v = buildTableView(D, cfg());
    expect(v.columns.map((c) => c.key)).toEqual(["name", "team", "score", "joined"]);
    expect(v.rows).toHaveLength(4);
    expect(v.total).toBe(4);
  });
  it("shows only the chosen columns, in the chosen order, ignoring ones that are gone", () => {
    const v = buildTableView(D, cfg({ columns: ["score", "gone", "name"] }));
    expect(v.columns.map((c) => c.key)).toEqual(["score", "name"]);
    expect(v.notes.join(" ")).toMatch(/1 column is no longer in this dataset/);
    expect(buildTableView(D, cfg({ columns: ["gone"] })).columns).toHaveLength(4); // never an empty table
  });
  it("sorts numbers numerically and text naturally, with empty values last either way", () => {
    expect(names(sortRows(D.rows, col("score"), "asc"))).toEqual(["Bo", "Di", "Ada", "Cy"]);
    expect(names(sortRows(D.rows, col("score"), "desc"))).toEqual(["Ada", "Di", "Bo", "Cy"]);
    expect(names(sortRows(D.rows, col("joined"), "asc"))).toEqual(["Di", "Bo", "Ada", "Cy"]);
    expect(names(sortRows(D.rows, col("name"), "desc"))).toEqual(["Di", "Cy", "Bo", "Ada"]);
  });
  it("is a stable sort: ties keep their order", () => {
    expect(names(sortRows(D.rows, col("team"), "asc"))).toEqual(["Ada", "Cy", "Bo", "Di"]);
  });
  it("applies the filters, then the sort, and reports what was hidden", () => {
    const v = buildTableView(D, cfg({ filters: [{ column: "team", op: "eq", value: "Eng" }], sort: { key: "name", dir: "desc" } }));
    expect(names(v.rows)).toEqual(["Cy", "Ada"]);
    expect(v.total).toBe(4);
    expect(v.notes.join(" ")).toMatch(/2 rows are hidden by filters/);
  });
  it("does not change the dataset", () => {
    const before = JSON.stringify(D.rows);
    buildTableView(D, cfg({ sort: { key: "score", dir: "desc" } }));
    expect(JSON.stringify(D.rows)).toBe(before);
  });
  it("works out each shaded column's range from the rows shown", () => {
    const all = buildTableView(D, cfg({ formats: { score: "scale" } }));
    expect(all.ranges.score).toEqual({ min: 45, max: 90 });
    const eng = buildTableView(D, cfg({ formats: { score: "bars" }, filters: [{ column: "team", op: "eq", value: "Eng" }] }));
    expect(eng.ranges.score).toEqual({ min: 90, max: 90 });
    expect(buildTableView(D, cfg({ formats: { name: "scale" } })).ranges).toEqual({}); // only numbers can be shaded
  });
  it("fraction places a value within its range", () => {
    expect(fraction(70, { min: 45, max: 95 })).toBe(0.5);
    expect(fraction(45, { min: 45, max: 95 })).toBe(0);
    expect(fraction(5, { min: 5, max: 5 })).toBe(1);
    expect(fraction(null, { min: 0, max: 1 })).toBeUndefined();
    expect(fraction("x", { min: 0, max: 1 })).toBeUndefined();
    expect(fraction(3, undefined)).toBeUndefined();
  });
});

describe("choosing columns", () => {
  it("hides a column, keeps the rest in order, and never hides the last one", () => {
    expect(toggleColumn(D.columns, undefined, "team")).toEqual(["name", "score", "joined"]);
    expect(toggleColumn(D.columns, ["name"], "name")).toEqual(["name"]);
  });
  it("a column you bring back joins at the end", () => {
    expect(toggleColumn(D.columns, ["score", "name"], "team")).toEqual(["score", "name", "team"]);
  });
  it("moves a column left or right, and stops at the ends", () => {
    expect(moveColumn(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveColumn(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(moveColumn(["a", "b", "c"], "zz", 1)).toEqual(["a", "b", "c"]);
  });
});

describe("table settings are stored safely", () => {
  it("round-trips through the document schema", () => {
    const d = docWith(D, { columns: ["name", "score"], sort: { key: "score", dir: "desc" }, formats: { score: "bars" }, density: "compact", pageSize: 50 });
    const back = parseVisualisation(JSON.parse(JSON.stringify(d)));
    expect(readTableConfig(back.configuration.options)).toMatchObject({ columns: ["name", "score"], sort: { key: "score", dir: "desc" }, formats: { score: "bars" }, density: "compact", pageSize: 50 });
  });
  it("falls back to defaults for damaged settings, and bounds what it accepts", () => {
    expect(readTableConfig({ table: { pageSize: 5000 } })).toEqual(defaultTableConfig());
    expect(readTableConfig(undefined)).toEqual(defaultTableConfig());
    expect(tableConfigSchema.safeParse({ formats: { a: "rainbow" } }).success).toBe(false);
  });
  it("clearing a setting (undefined) still saves", () => {
    const d = withTable(docWith(D), { ...cfg(), columns: undefined, sort: undefined });
    expect(() => parseVisualisation(d)).not.toThrow();
  });
});

describe("exporting a table", () => {
  const manager = createExportManager(createEntitlementService());
  it("offers CSV, image, embed and JSON once there is data, and only JSON before", () => {
    expect(manager.available(docWith(D)).map((e) => e.id)).toEqual(["png", "svg", "html-embed", "csv-table", "vizora-json"]);
    expect(manager.available(createVisualisation({ title: "T", type: "table" })).map((e) => e.id)).toEqual(["vizora-json"]);
  });
  it("the CSV is the table as set up: visible columns in order, filtered and sorted, every matching row", async () => {
    const d = docWith(D, { columns: ["name", "score"], sort: { key: "score", dir: "desc" }, filters: [{ column: "score", op: "gt", value: "50" }] });
    const { filename, blob } = await manager.export("csv-table", d);
    expect(filename).toBe("team-table.csv");
    expect((await blob.text()).replace("﻿", "").trim().split(/\r?\n/)).toEqual(["name,score", "Ada,90", "Di,70"]);
  });
  it("the image is well-formed SVG with the visible columns, shading and the sort", async () => {
    const d = docWith(D, { columns: ["name", "score"], sort: { key: "score", dir: "desc" }, formats: { score: "bars" } });
    const { svg } = renderTableSvg(d);
    const xml = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(xml.querySelector("parsererror")).toBeNull();
    for (const t of ["Team", "name", "score", "Ada", "Di", "Bo"]) expect(svg).toContain(t);
    expect(svg).not.toContain(">team<"); // a hidden column is not drawn
    expect(svg.indexOf(">Ada<")).toBeLessThan(svg.indexOf(">Bo<")); // sorted by score, largest first
    expect(svg).toContain('fill-opacity="0.5"'); // data bars
    expect((await renderSvgFor(d)).svg).toBe(svg);
  });
  it("a big table is cut to 40 rows and 12 columns, and the picture says so", () => {
    const head = Array.from({ length: 15 }, (_, i) => `c${i}`).join(",");
    const rows = Array.from({ length: 90 }, (_, r) => Array.from({ length: 15 }, (_, i) => `${r}-${i}`).join(","));
    const { svg } = renderTableSvg(docWith(ds([head, ...rows].join("\n"))));
    expect(svg).toContain(`first ${TABLE_IMAGE_MAX_ROWS} of 90 rows`);
    expect(svg).toContain(`${TABLE_IMAGE_MAX_COLUMNS} of 15 columns`);
    expect(svg).not.toContain("c14");
  });
  it("markup in data and titles cannot break or inject into the image", () => {
    const evil = ds('name,note\n"<script>x</script>","a & ""b"""');
    const d = { ...docWith(evil), title: "<b>Hi</b>" };
    const { svg } = renderTableSvg(d);
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("<b>");
    expect(new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("parsererror")).toBeNull();
  });
  it("explains when there is nothing to draw", () => {
    expect(() => renderTableSvg(createVisualisation({ title: "T", type: "table" }))).toThrow(/no data to show/i);
  });
});
