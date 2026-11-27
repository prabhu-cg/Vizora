import { buildDataset } from "./build";
import { readFile, sheetToTable } from "./read";
import type { BuildOptions, IngestPreview, SourceInfo } from "./types";

/** What the page needs to know about a file once it has been read. The rows stay with the reader. */
export interface ReadSummary {
  source: SourceInfo;
  sheets?: string[];
  sheet?: string;
}

export interface FileBuildOptions extends BuildOptions {
  sheet?: string;
}

/**
 * Reads one file and builds datasets from it. Runs in a Web Worker so a large
 * workbook never freezes the page; the same code runs on the page itself where
 * workers are unavailable (and in tests).
 */
export function createIngestCore() {
  let current: Awaited<ReturnType<typeof readFile>> | undefined;
  return {
    async read(file: File): Promise<ReadSummary> {
      current = undefined;
      current = await readFile(file);
      return { source: current.source, sheets: current.raw.sheets, sheet: current.raw.sheet };
    },
    build(options: FileBuildOptions): IngestPreview {
      if (!current) throw new Error("No file has been read yet.");
      const { sheet, ...rest } = options;
      const raw = current.workbook ? sheetToTable(current.workbook, sheet) : current.raw;
      return buildDataset(raw, { ...rest, name: rest.name ?? "Dataset" });
    },
  };
}

export type IngestRequestBody = { type: "read"; file: File } | { type: "build"; options: FileBuildOptions };
export type IngestRequest = IngestRequestBody & { id: number };
export type IngestResponse = { id: number; ok: true; result: ReadSummary | IngestPreview } | { id: number; ok: false; message: string; ingest: boolean };
