import { createId } from "@/lib/utils/id";
import type { IngestResult } from "@/types/data";
import type { Cell, Column } from "@/types/visualisation";
import { detectDelimiter, parseCsv } from "./csv";
import { coerceText, inferColumnType, normaliseHeaders } from "./infer";

export const MAX_INGEST_BYTES = 25 * 1024 * 1024;
export const MAX_INGEST_ROWS = 200_000;
export const MAX_INGEST_COLUMNS = 500;

export class IngestError extends Error {
  override name = "IngestError";
}

export interface IngestInput {
  text: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

export type IngestFormat = "csv" | "json";

export function detectFormat(input: Pick<IngestInput, "name" | "mimeType" | "text">): IngestFormat {
  const name = input.name?.toLowerCase() ?? "";
  if (name.endsWith(".json") || input.mimeType === "application/json") return "json";
  if (name.endsWith(".csv") || name.endsWith(".tsv") || input.mimeType === "text/csv") return "csv";
  const head = input.text.trimStart()[0];
  return head === "[" || head === "{" ? "json" : "csv";
}

function datasetName(name: string | undefined): string {
  const base = (name ?? "").replace(/\.[^.]+$/, "").trim();
  return (base || "Dataset").slice(0, 200);
}

function build(
  format: IngestFormat,
  input: IngestInput,
  headers: { key: string; label: string }[],
  matrix: Cell[][],
  warnings: string[],
): IngestResult {
  if (headers.length === 0) throw new IngestError("No columns were found in this file.");
  if (headers.length > MAX_INGEST_COLUMNS) {
    throw new IngestError(`Too many columns (${headers.length}). The limit is ${MAX_INGEST_COLUMNS}.`);
  }
  if (matrix.length > MAX_INGEST_ROWS) {
    throw new IngestError(`Too many rows (${matrix.length.toLocaleString()}). The limit is ${MAX_INGEST_ROWS.toLocaleString()}.`);
  }
  const columns: Column[] = headers.map((h, c) => ({
    key: h.key,
    label: h.label,
    type: inferColumnType(matrix.map((r) => r[c] ?? null)),
  }));
  const rows = matrix.map((r) => Object.fromEntries(headers.map((h, c) => [h.key, r[c] ?? null])));
  return {
    dataset: { id: createId(), name: datasetName(input.name), columns, rows },
    warnings,
    source: {
      kind: format,
      name: input.name,
      mimeType: input.mimeType || undefined,
      size: input.size ?? input.text.length,
    },
  };
}

function ingestCsv(input: IngestInput): IngestResult {
  const warnings: string[] = [];
  let table: string[][];
  try {
    table = parseCsv(input.text, detectDelimiter(input.text));
  } catch (e) {
    throw new IngestError(`Could not read this CSV: ${e instanceof Error ? e.message : "invalid format"}`);
  }
  const [headerRow, ...body] = table;
  if (!headerRow) throw new IngestError("This file is empty.");
  const headers = normaliseHeaders(headerRow);
  let ragged = 0;
  const matrix = body.map((cells) => {
    if (cells.length !== headers.length) ragged++;
    return headers.map((_, c) => coerceText(cells[c] ?? ""));
  });
  if (ragged > 0) {
    warnings.push(`${ragged} row${ragged === 1 ? " has" : "s have"} a different number of fields than the header; missing values were left empty and extras ignored.`);
  }
  return build("csv", input, headers, matrix, warnings);
}

function ingestJson(input: IngestInput): IngestResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.text);
  } catch {
    throw new IngestError("This file is not valid JSON.");
  }
  if (!Array.isArray(parsed)) {
    throw new IngestError("Expected a JSON array of objects, for example [{\"name\": \"A\", \"value\": 1}].");
  }
  if (parsed.length === 0) throw new IngestError("The JSON array is empty.");
  const warnings: string[] = [];
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new IngestError("Every item in the array must be an object.");
    }
    for (const k of Object.keys(item)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  let nested = 0;
  const matrix = (parsed as Record<string, unknown>[]).map((item) =>
    keys.map((k): Cell => {
      const v = item[k];
      if (v === undefined || v === null) return null;
      if (typeof v === "string" || typeof v === "boolean") return v;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      nested++;
      return JSON.stringify(v);
    }),
  );
  if (nested > 0) warnings.push(`${nested} nested value${nested === 1 ? " was" : "s were"} stored as JSON text.`);
  const headers = normaliseHeaders(keys);
  return build("json", input, headers, matrix, warnings);
}

/** Parse raw text from a file or paste into a validated tabular dataset. */
export function ingest(input: IngestInput): IngestResult {
  const size = input.size ?? input.text.length;
  if (size > MAX_INGEST_BYTES) {
    throw new IngestError(`This file is too large (${(size / 1048576).toFixed(1)} MB). The limit is ${MAX_INGEST_BYTES / 1048576} MB.`);
  }
  if (!input.text.trim()) throw new IngestError("This file is empty.");
  return detectFormat(input) === "json" ? ingestJson(input) : ingestCsv(input);
}
