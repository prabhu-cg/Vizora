import type { Cell, Column, Dataset } from "@/types/visualisation";

export type ColumnType = Column["type"];
export type SourceFormat = "csv" | "tsv" | "json" | "xlsx" | "paste";

/** What a reader found, before any typing decisions. Cells may be strings or native values. */
export interface RawTable {
  format: SourceFormat;
  rows: unknown[][];
  /** Set by formats that carry their own header (JSON objects). */
  headers?: string[];
  delimiter?: string;
  /** Excel: every sheet's name, and which one these rows came from. */
  sheets?: string[];
  sheet?: string;
}

export interface DataWarning {
  code: string;
  message: string;
  column?: string;
}

export interface BuildOptions {
  /** "auto" decides from the content. */
  header?: "auto" | boolean;
  /** Force the type of columns by position (0-based). Unparseable values become missing. */
  types?: Readonly<Record<number, ColumnType>>;
  removeDuplicates?: boolean;
  name?: string;
}

export interface ColumnProfile {
  key: string;
  label: string;
  type: ColumnType;
  count: number;
  missing: number;
  missingPct: number;
  distinct: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  median?: number;
  sum?: number;
  top: { value: string; count: number }[];
  /** Plain-language observations, e.g. that a % sign was dropped. */
  notes: string[];
}

export interface DatasetProfile {
  rows: number;
  columns: ColumnProfile[];
  duplicateRows: number;
  /** Percentage of cells that are not missing. */
  completeness: number;
}

export interface IngestPreview {
  dataset: Dataset;
  profile: DatasetProfile;
  warnings: DataWarning[];
  /** First rows, for display. The full dataset is `dataset`. */
  previewRows: Record<string, Cell>[];
  header: boolean;
  /** Rows dropped because they were completely empty. */
  skippedEmptyRows: number;
  duplicatesRemoved: number;
}

export interface SourceInfo {
  name?: string;
  mimeType?: string;
  size: number;
  format: SourceFormat;
  sha256?: string;
  sheet?: string;
}

export const MAX_INGEST_BYTES = 25 * 1024 * 1024;
export const MAX_INGEST_ROWS = 200_000;
export const MAX_INGEST_COLUMNS = 500;
export const PREVIEW_ROWS = 20;

export class IngestError extends Error {
  override name = "IngestError";
}
