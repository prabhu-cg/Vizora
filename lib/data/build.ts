import { createId } from "@/lib/utils/id";
import type { Cell, Column, Dataset } from "@/types/visualisation";
import { profileDataset } from "./profile";
import {
  IngestError, MAX_INGEST_COLUMNS, MAX_INGEST_ROWS, PREVIEW_ROWS,
  type BuildOptions, type ColumnType, type DataWarning, type IngestPreview, type RawTable,
} from "./types";
import { isMissing, parseBoolean, parseDate, parseNumber, toText } from "./values";

const looksTyped = (v: unknown): boolean => parseNumber(v) !== undefined || parseDate(v) !== undefined || parseBoolean(v) !== undefined;

/**
 * The first row is a header when every non-blank cell in it is plain text
 * (not a number, date or yes/no) and at least half the cells are filled.
 * Blank and repeated names are allowed: exports often have both.
 */
export function detectHeader(rows: readonly unknown[][]): boolean {
  const first = rows[0];
  if (!first || first.length === 0) return false;
  const filled = first.filter((c) => !isMissing(c));
  if (filled.length === 0 || filled.length < first.length / 2) return false;
  return filled.every((c) => typeof c === "string" && !looksTyped(c));
}

export function normaliseHeaders(headers: readonly string[]): { key: string; label: string }[] {
  const used = new Set<string>();
  return headers.map((raw, i) => {
    const label = raw.trim().slice(0, 200) || `Column ${i + 1}`;
    let key = label;
    let n = 2;
    while (used.has(key)) key = `${label}_${n++}`;
    used.add(key);
    return { key, label };
  });
}

/** Decide a column's type from its non-missing raw values. Strict: one stray value makes it text. */
export function inferType(values: readonly unknown[]): ColumnType {
  const present = values.filter((v) => !isMissing(v));
  if (present.length === 0) return "unknown";
  if (present.every((v) => parseNumber(v) !== undefined)) return "number";
  if (present.every((v) => parseBoolean(v) !== undefined)) return "boolean";
  if (present.every((v) => parseDate(v) !== undefined)) return "date";
  return "string";
}

function convert(v: unknown, type: ColumnType): { cell: Cell; bad?: boolean; note?: "percent" | "currency"; ambiguous?: boolean } {
  if (isMissing(v)) return { cell: null };
  switch (type) {
    case "number": {
      const n = parseNumber(v);
      return n ? { cell: n.value, note: n.note } : { cell: null, bad: true };
    }
    case "boolean": {
      const b = parseBoolean(v);
      return b === undefined ? { cell: null, bad: true } : { cell: b };
    }
    case "date": {
      const d = parseDate(v);
      return d ? { cell: d.value, ambiguous: d.ambiguous } : { cell: null, bad: true };
    }
    default:
      return { cell: toText(v).trim() };
  }
}

/**
 * Turn a raw table into a typed dataset with a profile and plain-language
 * warnings. Pure: the same input and options always give the same result, and
 * the raw rows are never mutated.
 */
export function buildDataset(raw: RawTable, options: BuildOptions = {}, id: () => string = createId): IngestPreview {
  const warnings: DataWarning[] = [];
  const warn = (code: string, message: string, column?: string) => warnings.push({ code, message, column });

  const rows = raw.rows;
  const width = Math.max(0, ...rows.map((r) => r.length), raw.headers?.length ?? 0);
  if (rows.length === 0 || width === 0) throw new IngestError("There is no data in this input.");

  const header = raw.headers ? true : options.header === "auto" || options.header === undefined ? detectHeader(rows) : options.header;
  const headerCells: string[] = raw.headers ?? (header ? Array.from({ length: width }, (_, i) => toText(rows[0]![i])) : Array.from({ length: width }, () => ""));
  let body = raw.headers || !header ? rows : rows.slice(1);

  // Entirely empty rows carry no information.
  const before = body.length;
  body = body.filter((r) => r.some((c) => !isMissing(c)));
  const skippedEmptyRows = before - body.length;
  if (skippedEmptyRows) warn("empty-rows", `${skippedEmptyRows} completely empty row${skippedEmptyRows === 1 ? " was" : "s were"} skipped.`);

  // Trailing columns with no header and no values (common in spreadsheet exports).
  let cols = width;
  while (cols > 1 && !headerCells[cols - 1]?.trim() && body.every((r) => isMissing(r[cols - 1]))) cols--;
  if (cols < width) warn("empty-columns", `${width - cols} empty column${width - cols === 1 ? " was" : "s were"} ignored.`);

  if (cols > MAX_INGEST_COLUMNS) throw new IngestError(`Too many columns (${cols}). The limit is ${MAX_INGEST_COLUMNS}.`);
  if (body.length > MAX_INGEST_ROWS) throw new IngestError(`Too many rows (${body.length.toLocaleString()}). The limit is ${MAX_INGEST_ROWS.toLocaleString()}.`);
  if (body.length === 0) throw new IngestError("There is a header but no data rows.");

  const names = normaliseHeaders(headerCells.slice(0, cols));
  const renamed = names.filter((n, i) => headerCells[i]?.trim() && n.label !== n.key).length;
  if (renamed) warn("duplicate-headers", `${renamed} repeated column name${renamed === 1 ? " was" : "s were"} made unique.`);

  const ragged = body.filter((r) => r.length !== cols && r.length !== 0).length;
  if (ragged && raw.format !== "json" && raw.format !== "xlsx") warn("ragged", `${ragged} row${ragged === 1 ? " has" : "s have"} a different number of fields than the header; missing values were left empty and extras ignored.`);

  const columns: Column[] = [];
  const notesByCol = new Map<string, string[]>();
  const data: unknown[][] = body.map((r) => Array.from({ length: cols }, (_, c) => r[c] ?? null));
  const typed: Cell[][] = data.map(() => new Array<Cell>(cols).fill(null));
  const ambiguousDates = new Set<string>();

  for (let c = 0; c < cols; c++) {
    const { key, label } = names[c]!;
    const column = data.map((r) => r[c]);
    const forced = options.types?.[c];
    const type = forced ?? inferType(column);
    let bad = 0;
    let percent = 0;
    let currency = 0;
    for (let r = 0; r < data.length; r++) {
      const out = convert(column[r], type === "unknown" ? "string" : type);
      typed[r]![c] = out.cell;
      if (out.bad) bad++;
      if (out.note === "percent") percent++;
      if (out.note === "currency") currency++;
      if (out.ambiguous && typeof out.cell === "string") ambiguousDates.add(String(column[r]).trim());
    }
    const notes: string[] = [];
    if (percent) notes.push(`${percent} value${percent === 1 ? "" : "s"} had a % sign; read as plain numbers (12% is 12).`);
    if (currency) notes.push(`A currency symbol was removed from ${currency} value${currency === 1 ? "" : "s"}.`);
    if (bad) {
      notes.push(`${bad} value${bad === 1 ? "" : "s"} could not be read as ${type} and ${bad === 1 ? "is" : "are"} treated as missing.`);
      warn("coerced", `Column “${label}”: ${bad} value${bad === 1 ? "" : "s"} could not be read as ${type} and ${bad === 1 ? "is" : "are"} treated as missing.`, label);
    }
    if (!forced && type === "string") {
      const present = column.filter((v) => !isMissing(v));
      const numeric = present.filter((v) => parseNumber(v) !== undefined).length;
      if (present.length >= 5 && numeric / present.length >= 0.9 && numeric < present.length) {
        const msg = `Column “${label}” is mostly numbers but ${present.length - numeric} value${present.length - numeric === 1 ? "" : "s"} (such as “${String(present.find((v) => parseNumber(v) === undefined)).slice(0, 20)}”) are not, so it is treated as text. Change its type to Number to chart it.`;
        notes.push(msg);
        warn("mostly-numeric", msg, label);
      }
    }
    notesByCol.set(key, notes);
    columns.push({ key, label, type });
  }
  if (ambiguousDates.size) warn("ambiguous-date", `Dates such as ${[...ambiguousDates].slice(0, 3).join(", ")} could be day/month or month/day. Day first (UK style) was assumed.`);

  let rowsOut: Record<string, Cell>[] = typed.map((r) => Object.fromEntries(columns.map((c, i) => [c.key, r[i] ?? null])));
  let duplicatesRemoved = 0;
  const seen = new Set<string>();
  const dupIdx: number[] = [];
  rowsOut.forEach((r, i) => {
    const k = JSON.stringify(columns.map((c) => r[c.key]));
    if (seen.has(k)) dupIdx.push(i);
    else seen.add(k);
  });
  if (dupIdx.length) {
    if (options.removeDuplicates) {
      const drop = new Set(dupIdx);
      rowsOut = rowsOut.filter((_, i) => !drop.has(i));
      duplicatesRemoved = dupIdx.length;
      warn("duplicates-removed", `${dupIdx.length} duplicate row${dupIdx.length === 1 ? " was" : "s were"} removed from the imported copy. Your file is unchanged.`);
    } else {
      warn("duplicates", `${dupIdx.length} row${dupIdx.length === 1 ? " is a duplicate" : "s are duplicates"} of earlier rows. They are kept unless you choose to remove them.`);
    }
  }
  if (rowsOut.length > 50_000) warn("large", "This is a large dataset. Charts may take a moment and saving may be slower.");

  const dataset: Dataset = {
    id: id(),
    name: (options.name ?? "Dataset").slice(0, 200) || "Dataset",
    origin: raw.format === "paste" ? "paste" : "import",
    columns,
    rows: rowsOut,
  };
  const profile = profileDataset(dataset);
  for (const cp of profile.columns) cp.notes = notesByCol.get(cp.key) ?? [];
  if (profile.columns.every((c) => c.count === 0)) throw new IngestError("Every cell is empty, so there is nothing to import.");
  const onlyMissing = profile.columns.filter((c) => c.count === 0);
  for (const c of onlyMissing) warn("empty-column", `Column “${c.label}” has no values.`, c.label);

  return { dataset, profile, warnings, previewRows: rowsOut.slice(0, PREVIEW_ROWS), header, skippedEmptyRows, duplicatesRemoved };
}
