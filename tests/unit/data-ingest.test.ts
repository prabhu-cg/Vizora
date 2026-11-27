import { describe, expect, it } from "vitest";
import {
  IngestError, MAX_INGEST_BYTES, buildDataset, datasetFromGrid, detectDelimiter, emptyGrid, inferType, isMissing, parseBoolean, parseCsv, parseDate, parseNumber,
  profileDataset, readFile, readText, setCell, setHeader, toCsv, validateFileHead, validateFileMeta, addColumn, addRow, removeColumn, removeRow,
} from "@/lib/data";
import { datasetSchema } from "@/lib/validation";
import { xlsxFile } from "../xlsx";

const ids = () => "ds";
const build = (text: string, opts = {}, hint = {}) => buildDataset(readText(text, hint), opts, ids);

describe("value recognition", () => {
  it("reads numbers in the common spreadsheet styles, and refuses to guess", () => {
    const n = (s: string) => parseNumber(s)?.value;
    expect([n("1234"), n("-1.5"), n("1e3"), n(" 42 "), n("1,234"), n("1,234,567.89"), n("1.234,56"), n("(500)"), n("£1,200"), n("$ 9.99"), n("12%")]).toEqual([1234, -1.5, 1000, 42, 1234, 1234567.89, 1234.56, -500, 1200, 9.99, 12]);
    expect(parseNumber("£1,200")!.note).toBe("currency");
    expect(parseNumber("12%")!.note).toBe("percent");
    for (const bad of ["007", "12,5", "1,23", "abc", "", "1.2.3", "NaN", "Infinity", "9007199254740993"]) expect(parseNumber(bad), bad).toBeUndefined();
  });
  it("reads booleans, dates and missing markers", () => {
    expect([parseBoolean("TRUE"), parseBoolean("no"), parseBoolean("maybe")]).toEqual([true, false, undefined]);
    expect(parseDate("2026-03-15")!.value).toBe("2026-03-15");
    expect(parseDate("15 March 2026")!.value).toBe("2026-03-15");
    expect(parseDate("15/03/2026")!.value).toBe("2026-03-15");
    expect(parseDate("03/04/2026")).toMatchObject({ value: "2026-04-03", ambiguous: true });
    expect(parseDate("2026-03-15 10:30:00")!.value).toBe("2026-03-15T10:30:00");
    expect(parseDate("2026-02-31")).toBeUndefined();
    expect(parseDate("2026")).toBeUndefined(); // a bare number stays a number
    expect(parseDate(new Date(Date.UTC(2026, 2, 15)))!.value).toBe("2026-03-15");
    for (const m of ["", "NA", "n/a", "NULL", "-", "none", null, undefined, NaN]) expect(isMissing(m), String(m)).toBe(true);
    expect(isMissing("0")).toBe(false);
    expect(isMissing(0)).toBe(false);
  });
  it("type inference is strict: one stray value makes a column text", () => {
    expect(inferType(["1", "2", "", "NA"])).toBe("number");
    expect(inferType(["1", "2", "x"])).toBe("string");
    expect(inferType(["2026-01-01", "2026-02-01"])).toBe("date");
    expect(inferType(["yes", "no"])).toBe("boolean");
    expect(inferType(["", "NA"])).toBe("unknown");
  });
});

describe("CSV / TSV / JSON / paste", () => {
  it("parses quotes, escaped quotes, embedded newlines, CRLF and BOM", () => {
    expect(parseCsv('﻿name,note\r\n"Smith, J","said ""hi"""\r\nA,"l1\nl2"\r\n', ",")).toEqual([["name", "note"], ["Smith, J", 'said "hi"'], ["A", "l1\nl2"]]);
    expect(() => parseCsv('a,"b', ",")).toThrow(/Unterminated/);
  });
  it("detects delimiters", () => {
    expect([detectDelimiter("a;b;c\n1;2;3"), detectDelimiter("a\tb\n1\t2"), detectDelimiter("a,b\n1,2")]).toEqual([";", "\t", ","]);
  });
  it("builds a typed dataset with a header, detecting types and missing values", () => {
    const r = build("Region,Revenue,Active,Since,Code\nNorth,100.5,true,2026-01-02,007\nSouth,200,false,2026-02-03,008\nEast,,true,NA,009", {}, { name: "sales.csv" });
    expect(r.header).toBe(true);
    expect(r.dataset.columns.map((c) => [c.key, c.type])).toEqual([["Region", "string"], ["Revenue", "number"], ["Active", "boolean"], ["Since", "date"], ["Code", "string"]]);
    expect(r.dataset.rows[2]).toMatchObject({ Revenue: null, Since: null, Code: "009" });
    expect(datasetSchema.safeParse(r.dataset).success).toBe(true);
    expect(r.profile.columns.find((c) => c.key === "Revenue")).toMatchObject({ missing: 1, missingPct: 33.3, min: 100.5, max: 200, sum: 300.5 });
  });
  it("detects a missing header and names the columns", () => {
    const r = build("1,2,3\n4,5,6");
    expect(r.header).toBe(false);
    expect(r.dataset.columns.map((c) => c.label)).toEqual(["Column 1", "Column 2", "Column 3"]);
    expect(r.dataset.rows).toHaveLength(2);
    expect(build("1,2,3\n4,5,6", { header: true }).dataset.rows).toHaveLength(1);
  });
  it("keeps repeated and blank column names unique, and says so", () => {
    const r = build("a,a,\n1,2,3\n4,5,6");
    expect(r.dataset.columns.map((c) => c.key)).toEqual(["a", "a_2", "Column 3"]);
    expect(r.warnings.map((w) => w.code)).toContain("duplicate-headers");
  });
  it("notes ragged rows, skips empty rows and ignores empty trailing columns", () => {
    const r = build("a,b,\n1,2,\n\n,,\n3\n4,5,");
    expect(r.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["ragged", "empty-columns"]));
    expect(r.dataset.rows).toHaveLength(3);
  });
  it("detects duplicate rows, keeps them by default and removes them from the copy on request", () => {
    const text = "a,b\n1,x\n2,y\n1,x\n1,x";
    const kept = build(text);
    expect(kept.profile.duplicateRows).toBe(2);
    expect(kept.warnings.map((w) => w.code)).toContain("duplicates");
    expect(kept.dataset.rows).toHaveLength(4);
    const removed = build(text, { removeDuplicates: true });
    expect(removed.dataset.rows).toHaveLength(2);
    expect(removed.duplicatesRemoved).toBe(2);
  });
  it("flags dd/mm dates as ambiguous and reads them day first", () => {
    const r = build("when,v\n03/04/2026,1\n05/06/2026,2");
    expect(r.dataset.columns[0]!.type).toBe("date");
    expect(r.dataset.rows[0]!.when).toBe("2026-04-03");
    expect(r.warnings.map((w) => w.code)).toContain("ambiguous-date");
  });
  it("explains a mostly-numeric text column and lets the user force the type", () => {
    const text = "v\n1\n2\n3\n4\n5\n6\n7\n8\n9\noops";
    const auto = build(text);
    expect(auto.dataset.columns[0]!.type).toBe("string");
    expect(auto.warnings.map((w) => w.code)).toContain("mostly-numeric");
    const forced = build(text, { types: { 0: "number" } });
    expect(forced.dataset.columns[0]!.type).toBe("number");
    expect(forced.dataset.rows.at(-1)!.v).toBeNull();
    expect(forced.warnings.find((w) => w.code === "coerced")!.message).toMatch(/1 value could not be read as number/);
  });
  it("notes percent and currency symbols in the profile", () => {
    const r = build("p,c\n10%,£5\n20%,£6");
    const [p, c] = r.profile.columns;
    expect(r.dataset.rows[0]).toEqual({ p: 10, c: 5 });
    expect(p!.notes[0]).toMatch(/% sign/);
    expect(c!.notes[0]).toMatch(/currency/);
  });
  it("reads a paste from a spreadsheet (tab separated) and a markdown table", () => {
    const tsv = build("Name\tQty\nApple\t3\nPear\t5", {}, { paste: true });
    expect(tsv.dataset).toMatchObject({ origin: "paste", columns: [{ key: "Name" }, { key: "Qty", type: "number" }] });
    const md = build("| Name | Qty |\n| --- | --- |\n| Apple | 3 |\n| Pear | 5 |", {}, { paste: true });
    expect(md.dataset.rows).toEqual([{ Name: "Apple", Qty: 3 }, { Name: "Pear", Qty: 5 }]);
  });
  it("reads JSON as an array of objects, arrays, a wrapper object, or columns", () => {
    expect(build('[{"a":1,"b":"x"},{"a":2,"c":{"d":true}}]', {}, { name: "d.json" }).dataset.columns.map((c) => c.key)).toEqual(["a", "b", "c"]);
    expect(build("[[\"k\",\"v\"],[\"a\",1],[\"b\",2]]", {}, { name: "d.json" }).dataset.rows).toEqual([{ k: "a", v: 1 }, { k: "b", v: 2 }]);
    expect(build('{"rows":[{"a":1},{"a":2}]}', {}, { name: "d.json" }).dataset.rows).toHaveLength(2);
    expect(build('{"a":[1,2,3],"b":["x","y","z"]}', {}, { name: "d.json" }).dataset.rows[2]).toEqual({ a: 3, b: "z" });
    expect(build('[{"a":1,"n":{"deep":1}}]', {}, { name: "d.json" }).dataset.rows[0]!.n).toBe('{"deep":1}');
  });
});

describe("invalid input is explained, never silently accepted", () => {
  it.each([
    ["empty", "   ", /no data/i],
    ["bad json", "{oops", /not valid JSON/],
    ["json scalar array", "[1,2]", /Every item/],
    ["json object of nothing useful", '{"a":1}', /Expected a JSON array/],
    ["empty json array", "[]", /empty/],
  ])("%s", (_n, text, message) => {
    expect(() => readText(text, { name: text.trim().startsWith("{") || text.trim().startsWith("[") ? "x.json" : undefined })).toThrow(message);
  });
  it("header only, all empty, too many columns/rows", () => {
    expect(() => build("a,b")).toThrow(/no data rows/);
    expect(() => build("a,b\n,\n,")).toThrow(IngestError);
    expect(() => build(`${Array.from({ length: 501 }, (_, i) => `c${i}`).join(",")}\n${Array.from({ length: 501 }, () => "1").join(",")}`)).toThrow(/Too many columns/);
  });
  it("file validation by name, size and content", () => {
    expect(validateFileMeta({ name: "a.CSV", size: 10 })).toBe("csv");
    expect(validateFileMeta({ name: "a.tsv", size: 10 })).toBe("tsv");
    expect(validateFileMeta({ name: "a.json", size: 10 })).toBe("json");
    expect(validateFileMeta({ name: "a.xlsx", size: 10 })).toBe("xlsx");
    expect(() => validateFileMeta({ name: "a.xls", size: 10 })).toThrow(/\.xls.*save as \.xlsx/i);
    expect(() => validateFileMeta({ name: "a.ods", size: 10 })).toThrow(/not supported/);
    expect(() => validateFileMeta({ name: "a.exe", size: 10 })).toThrow(/not supported/);
    expect(() => validateFileMeta({ name: "noext", size: 10 })).toThrow(/not supported/);
    expect(() => validateFileMeta({ name: "a.csv", size: 0 })).toThrow(/empty/);
    expect(() => validateFileMeta({ name: "a.csv", size: MAX_INGEST_BYTES + 1 })).toThrow(/too large/);
    expect(() => validateFileHead("csv", new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toThrow(/zipped or Office/);
    expect(() => validateFileHead("csv", new Uint8Array([97, 0, 98]))).toThrow(/binary/);
    expect(() => validateFileHead("xlsx", new Uint8Array([1, 2, 3, 4]))).toThrow(/not a valid \.xlsx/);
    expect(() => validateFileHead("csv", new TextEncoder().encode("a,b\n1,2"))).not.toThrow();
  });
});

describe("Excel (.xlsx)", () => {
  const sales = {
    name: "Sales",
    rows: [
      ["Month", "Revenue", "Closed", "Date"],
      ["Jan", 120.5, true, new Date(Date.UTC(2026, 0, 31))],
      ["Feb", 150, false, new Date(Date.UTC(2026, 1, 28))],
      ["Mar", null, true, new Date(Date.UTC(2026, 2, 31))],
    ],
  };
  it("imports strings, numbers, booleans and dates, with missing cells", async () => {
    const read = await readFile(xlsxFile([sales], "sales.xlsx"));
    expect(read.raw.format).toBe("xlsx");
    expect(read.source).toMatchObject({ name: "sales.xlsx", format: "xlsx", sheet: "Sales" });
    expect(read.source.sha256).toMatch(/^[0-9a-f]{64}$/);
    const r = buildDataset(read.raw, { name: "sales" }, ids);
    expect(r.dataset.columns.map((c) => [c.key, c.type])).toEqual([["Month", "string"], ["Revenue", "number"], ["Closed", "boolean"], ["Date", "date"]]);
    expect(r.dataset.rows[0]).toEqual({ Month: "Jan", Revenue: 120.5, Closed: true, Date: "2026-01-31" });
    expect(r.dataset.rows[2]!.Revenue).toBeNull();
    expect(datasetSchema.safeParse(r.dataset).success).toBe(true);
  });
  it("lists every sheet and imports the one chosen", async () => {
    const f = xlsxFile([sales, { name: "Costs", rows: [["Item", "Amount"], ["Rent", 900], ["Power", 120]] }]);
    const first = await readFile(f);
    expect(first.raw.sheets).toEqual(["Sales", "Costs"]);
    expect(first.raw.sheet).toBe("Sales");
    const second = await readFile(f, { sheet: "Costs" });
    expect(buildDataset(second.raw, {}, ids).dataset.rows).toEqual([{ Item: "Rent", Amount: 900 }, { Item: "Power", Amount: 120 }]);
  });
  it("explains corrupt and mislabelled workbooks", async () => {
    await expect(readFile(new File([new Uint8Array([80, 75, 3, 4, 1, 2, 3])], "bad.xlsx"))).rejects.toThrow(IngestError);
    await expect(readFile(new File([new TextEncoder().encode("a,b\n1,2")], "fake.xlsx"))).rejects.toThrow(/not a valid \.xlsx/);
    await expect(readFile(new File([new TextEncoder().encode("a,b")], "old.xls"))).rejects.toThrow(/\.xls/);
    await expect(readFile(xlsxFile([{ name: "Empty", rows: [] }]))).rejects.toThrow(IngestError);
  });
});

describe("the original is never modified", () => {
  it("building a dataset does not touch the raw rows", () => {
    const raw = readText("a,b\n1,x\n1,x\n2,y");
    const snapshot = JSON.stringify(raw);
    buildDataset(raw, { removeDuplicates: true, types: { 0: "string" } }, ids);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });
  it("reading a file does not change its bytes, and the recorded checksum is reproducible", async () => {
    const bytes = new TextEncoder().encode("a,b\n1,2\n3,4\n");
    const file = new File([bytes], "x.csv");
    const a = await readFile(file);
    const b = await readFile(file);
    expect(a.source.sha256).toBe(b.source.sha256);
    expect(Array.from(new Uint8Array(await file.arrayBuffer()))).toEqual(Array.from(bytes));
  });
});

describe("profiling", () => {
  it("reports counts, missing, distinct, central values and the most common entries", () => {
    const r = build("team,score\nA,10\nA,20\nB,30\nB,\nC,40");
    const team = r.profile.columns[0]!, score = r.profile.columns[1]!;
    expect(r.profile).toMatchObject({ rows: 5, duplicateRows: 0 });
    expect(r.profile.completeness).toBe(90);
    expect(team).toMatchObject({ distinct: 3, missing: 0, top: [{ value: "A", count: 2 }, { value: "B", count: 2 }, { value: "C", count: 1 }] });
    expect(score).toMatchObject({ count: 4, missing: 1, min: 10, max: 40, sum: 100, mean: 25, median: 25 });
    expect(profileDataset({ columns: [], rows: [] }).completeness).toBe(100);
  });
});

describe("manual entry", () => {
  it("turns a typed grid into a typed dataset and supports editing the grid", () => {
    let g = emptyGrid(2, 2);
    g = setHeader(setHeader(g, 0, "Fruit"), 1, "Qty");
    g = setCell(setCell(g, 0, 0, "Apple"), 0, 1, "3");
    g = addRow(g);
    g = setCell(setCell(g, 2, 0, "Pear"), 2, 1, "1,200");
    const d = datasetFromGrid(g, { id: "m", name: "Fruit" });
    expect(d).toMatchObject({ id: "m", origin: "manual", columns: [{ key: "Fruit", type: "string" }, { key: "Qty", type: "number" }] });
    expect(d.rows).toEqual([{ Fruit: "Apple", Qty: 3 }, { Fruit: "Pear", Qty: 1200 }]); // the blank row is dropped
    expect(datasetSchema.safeParse(d).success).toBe(true);
    expect(addColumn(g).headers).toHaveLength(3);
    expect(removeColumn(g, 0).headers).toEqual(["Qty"]);
    expect(removeColumn(removeColumn(g, 0), 0).headers).toHaveLength(1); // always at least one column
    expect(removeRow(g, 0).rows).toHaveLength(2);
  });
});

describe("CSV writing", () => {
  it("quotes where needed and neutralises spreadsheet formulas", () => {
    expect(toCsv([["a", "b,c", 'say "hi"', null], [1, "x\ny", "=SUM(A1)", "-5"]])).toBe('a,"b,c","say ""hi""",\r\n1,"x\ny",\'=SUM(A1),-5\r\n');
  });
  it("round-trips through the parser", () => {
    const rows = [["h1", "h2"], ["a,b", 'q"q'], ["line\nbreak", "z"]];
    expect(parseCsv(toCsv(rows), ",")).toEqual(rows);
  });
});
