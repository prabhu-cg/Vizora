import { describe, expect, it } from "vitest";
import { IngestError, MAX_INGEST_BYTES, detectDelimiter, ingest, parseCsv } from "@/lib/parsers";
import { addDatasetToVisualisation } from "@/features/data-import";
import { datasetSchema } from "@/lib/validation";
import { sampleDoc } from "../helpers";

describe("CSV parsing", () => {
  it("handles quotes, escaped quotes, embedded newlines, CRLF and BOM", () => {
    const text = '﻿name,note\r\n"Smith, J","said ""hi"""\r\nA,"line1\nline2"\r\n';
    expect(parseCsv(text, ",")).toEqual([
      ["name", "note"],
      ["Smith, J", 'said "hi"'],
      ["A", "line1\nline2"],
    ]);
  });
  it("detects delimiters", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(detectDelimiter("a,b\n1,2")).toBe(",");
  });
  it("rejects unterminated quotes", () => {
    expect(() => parseCsv('a,"b', ",")).toThrow(/Unterminated/);
  });
});

describe("ingest", () => {
  it("infers types and produces a schema-valid dataset", () => {
    const { dataset, source, warnings } = ingest({
      name: "sales.csv",
      text: "Region,Revenue,Active,Since,Code\nNorth,100.5,true,2026-01-02,007\nSouth,200,false,2026-02-03,008\nEast,,true,2026-03-04,009",
    });
    expect(dataset.name).toBe("sales");
    expect(dataset.columns.map((c) => [c.key, c.type])).toEqual([
      ["Region", "string"],
      ["Revenue", "number"],
      ["Active", "boolean"],
      ["Since", "date"],
      ["Code", "string"], // leading zeros preserved as text
    ]);
    expect(dataset.rows[2]!.Revenue).toBeNull();
    expect(dataset.rows[0]!.Code).toBe("007");
    expect(datasetSchema.safeParse(dataset).success).toBe(true);
    expect(source.kind).toBe("csv");
    expect(warnings).toEqual([]);
  });

  it("dedupes and names blank headers, and warns about ragged rows", () => {
    const { dataset, warnings } = ingest({ name: "x.csv", text: "a,a,\n1,2,3\n4,5" });
    expect(dataset.columns.map((c) => c.key)).toEqual(["a", "a_2", "Column 3"]);
    expect(warnings[0]).toMatch(/1 row has/);
  });

  it("ingests JSON arrays of objects, unioning keys and flagging nested values", () => {
    const { dataset, warnings, source } = ingest({
      name: "d.json",
      text: JSON.stringify([{ a: 1, b: "x" }, { a: 2, c: { deep: true } }]),
    });
    expect(source.kind).toBe("json");
    expect(dataset.columns.map((c) => c.key)).toEqual(["a", "b", "c"]);
    expect(dataset.rows[1]).toEqual({ a: 2, b: null, c: '{"deep":true}' });
    expect(warnings[0]).toMatch(/nested/);
  });

  it("sniffs JSON without a file extension", () => {
    expect(ingest({ text: '[{"k":1}]' }).source.kind).toBe("json");
  });

  it.each([
    ["empty", { text: "   " }, /empty/],
    ["bad json", { name: "a.json", text: "{oops" }, /not valid JSON/],
    ["json object", { name: "a.json", text: '{"a":1}' }, /array of objects/],
    ["json primitives", { name: "a.json", text: "[1,2]" }, /must be an object/],
    ["oversize", { name: "a.csv", text: "a\n1", size: MAX_INGEST_BYTES + 1 }, /too large/],
  ])("rejects %s with a clear message", (_n, input, message) => {
    expect(() => ingest(input)).toThrow(IngestError);
    expect(() => ingest(input)).toThrow(message);
  });

  it("attaches datasets to a visualisation immutably and records provenance", () => {
    const doc = sampleDoc();
    const result = ingest({ name: "t.csv", text: "a,b\n1,2" });
    const next = addDatasetToVisualisation(doc, result);
    expect(doc.data.datasets).toHaveLength(0);
    expect(next.data.datasets).toHaveLength(1);
    expect(next.source).toMatchObject({ kind: "csv", name: "t.csv" });
    expect(next.source.importedAt).toBeTruthy();
  });
});
