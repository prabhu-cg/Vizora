import { toText } from "./values";
import { detectDelimiter, parseCsv, parsePipeTable } from "./csv";
import { IngestError, MAX_INGEST_BYTES, type RawTable, type SourceFormat, type SourceInfo } from "./types";

export const ACCEPTED_EXTENSIONS = [".csv", ".tsv", ".txt", ".json", ".xlsx"] as const;
export const ACCEPT_ATTRIBUTE = ".csv,.tsv,.txt,.json,.xlsx,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const extOf = (name: string) => (/\.[^./\\]+$/.exec(name.toLowerCase()) ?? [""])[0];
const mb = (n: number) => (n / 1048576).toFixed(1);

/** Checks that need only the file's name and size, so they can run before reading a byte. */
export function validateFileMeta(file: { name: string; size: number }): SourceFormat {
  const ext = extOf(file.name);
  if (ext === ".xls") throw new IngestError("Old Excel files (.xls) cannot be read. Open it in Excel and save as .xlsx or CSV, then import that.");
  if (ext === ".xlsm" || ext === ".xlsb" || ext === ".ods" || ext === ".numbers") {
    throw new IngestError(`${ext} files are not supported. Save the sheet as .xlsx or CSV and import that.`);
  }
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new IngestError(`${ext ? `“${ext}” files are` : "This file type is"} not supported. Use CSV, TSV, JSON or Excel (.xlsx), or paste your data.`);
  }
  if (file.size === 0) throw new IngestError("This file is empty.");
  if (file.size > MAX_INGEST_BYTES) throw new IngestError(`This file is too large (${mb(file.size)} MB). The limit is ${mb(MAX_INGEST_BYTES)} MB.`);
  return ext === ".xlsx" ? "xlsx" : ext === ".json" ? "json" : ext === ".tsv" ? "tsv" : "csv";
}

const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05);

/** Content checks on the first bytes: a ".csv" that is really a zip or a binary is rejected with a clear reason. */
export function validateFileHead(format: SourceFormat, head: Uint8Array): void {
  if (format === "xlsx") {
    if (!isZip(head)) throw new IngestError("This file is not a valid .xlsx workbook (it is not a zip archive). It may be corrupted or have the wrong extension.");
    return;
  }
  if (isZip(head)) throw new IngestError("This looks like a zipped or Office file, not text. If it is an Excel workbook, rename it to .xlsx; if it is a zip, unzip it first.");
  if (head.includes(0)) throw new IngestError("This looks like a binary file, not text, so it cannot be read as CSV or JSON.");
}

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string | undefined> {
  try {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const digest = await crypto.subtle.digest("SHA-256", view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined; // WebCrypto unavailable: provenance is optional
  }
}

function jsonToTable(parsed: unknown): RawTable {
  const fail = (msg: string): never => {
    throw new IngestError(msg);
  };
  const objectRows = (items: Record<string, unknown>[]): RawTable => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const item of items) for (const k of Object.keys(item)) if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
    return { format: "json", headers: keys, rows: items.map((item) => keys.map((k) => item[k] ?? null)) };
  };
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return fail("The JSON array is empty.");
    if (parsed.every(isObj)) return objectRows(parsed);
    if (parsed.every((r) => Array.isArray(r))) return { format: "json", rows: parsed as unknown[][] };
    return fail("Every item in the array must be an object (a row), or every item an array of cells.");
  }
  if (isObj(parsed)) {
    const entries = Object.entries(parsed);
    // {"rows": [ {...}, {...} ]} — a wrapper around the real table.
    const wrapped = entries.filter(([, v]) => Array.isArray(v) && v.length > 0 && v.every(isObj));
    if (wrapped.length === 1 && entries.every(([, v]) => !Array.isArray(v) || v === wrapped[0]![1] || (v as unknown[]).length === 0 || typeof v !== "object")) {
      return objectRows(wrapped[0]![1] as Record<string, unknown>[]);
    }
    // {"a": [1,2,3], "b": [4,5,6]} — column-oriented.
    if (entries.length > 0 && entries.every(([, v]) => Array.isArray(v) && v.every((x) => x === null || typeof x !== "object"))) {
      const cols = entries as [string, unknown[]][];
      const n = Math.max(...cols.map(([, v]) => v.length));
      return { format: "json", headers: cols.map(([k]) => k), rows: Array.from({ length: n }, (_, i) => cols.map(([, v]) => v[i] ?? null)) };
    }
  }
  return fail('Expected a JSON array of objects, for example [{"name": "A", "value": 1}], or an object of equal-length arrays.');
}

/** Read CSV, TSV, JSON, pipe tables or spreadsheet pastes from text. */
export function readText(text: string, hint: { name?: string; paste?: boolean } = {}): RawTable {
  if (!text.trim()) throw new IngestError("There is no data to read.");
  const ext = extOf(hint.name ?? "");
  const head = text.trimStart()[0];
  if (ext === ".json" || (!ext && (head === "[" || head === "{"))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new IngestError("This is not valid JSON.");
    }
    return jsonToTable(parsed);
  }
  const format: SourceFormat = hint.paste ? "paste" : ext === ".tsv" ? "tsv" : "csv";
  if (hint.paste) {
    const piped = parsePipeTable(text);
    if (piped) return { format, rows: piped, delimiter: "|" };
  }
  const delimiter = ext === ".tsv" ? "\t" : detectDelimiter(text);
  let rows: string[][];
  try {
    rows = parseCsv(text, delimiter);
  } catch (e) {
    throw new IngestError(`Could not read this as CSV: ${e instanceof Error ? e.message : "invalid format"}`);
  }
  if (rows.length === 0) throw new IngestError("No rows were found.");
  return { format, rows, delimiter };
}

export interface XlsxWorkbook {
  sheets: { name: string; rows: unknown[][] }[];
}

/** Parse an .xlsx workbook locally. The library is loaded on demand so it never weighs on pages that do not import files. */
export async function readXlsx(input: ArrayBuffer | Blob): Promise<XlsxWorkbook> {
  const { default: readXlsxFile, InvalidInputError } = await import("read-excel-file/universal");
  try {
    const sheets = await readXlsxFile(input);
    return { sheets: sheets.map((s) => ({ name: s.sheet, rows: s.data as unknown[][] })) };
  } catch (e) {
    if (e instanceof InvalidInputError) {
      const msg =
        e.code === "XLS_FILE_NOT_SUPPORTED"
          ? "Old Excel files (.xls) cannot be read. Save as .xlsx or CSV and import that."
          : e.code === "NO_DATA"
            ? "This workbook contains no data."
            : "This is not a valid .xlsx workbook. It may be corrupted, password-protected or have the wrong extension.";
      throw new IngestError(msg);
    }
    throw new IngestError("This workbook could not be read. It may be corrupted or password-protected.");
  }
}

export function sheetToTable(wb: XlsxWorkbook, sheetName?: string): RawTable {
  const chosen = wb.sheets.find((s) => s.name === sheetName) ?? wb.sheets.find((s) => s.rows.length > 0) ?? wb.sheets[0];
  if (!chosen || chosen.rows.length === 0) throw new IngestError("The selected sheet is empty.");
  return { format: "xlsx", rows: chosen.rows, sheets: wb.sheets.map((s) => s.name), sheet: chosen.name };
}

export interface FileRead {
  raw: RawTable;
  source: SourceInfo;
  /** Excel only: kept so another sheet can be chosen without re-reading the file. */
  workbook?: XlsxWorkbook;
}

/**
 * Read a user-chosen file entirely in the browser. The file is only read,
 * never written; its SHA-256 is recorded so that can be demonstrated.
 */
export async function readFile(file: File, opts: { sheet?: string } = {}): Promise<FileRead> {
  const format = validateFileMeta(file);
  const buffer = await file.arrayBuffer();
  validateFileHead(format, new Uint8Array(buffer, 0, Math.min(4096, buffer.byteLength)));
  const sha256 = await sha256Hex(buffer);
  const base = { name: file.name, mimeType: file.type || undefined, size: file.size, sha256 };
  if (format === "xlsx") {
    const workbook = await readXlsx(buffer);
    const raw = sheetToTable(workbook, opts.sheet);
    return { raw, workbook, source: { ...base, format: "xlsx", sheet: raw.sheet } };
  }
  const text = new TextDecoder("utf-8").decode(buffer);
  const raw = readText(text, { name: file.name });
  return { raw, source: { ...base, format: raw.format } };
}

export { toText };
