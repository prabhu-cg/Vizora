import type { z } from "zod";
import type { backupEnvelopeSchema } from "@/lib/validation/backup.schema";
import type { Dataset } from "@/types/visualisation";

export type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>;

export type ConflictPolicy = "skip" | "keep-both";

export interface BackupPreview {
  projects: { total: number; new: number; existing: number };
  visualisations: { total: number; new: number; existing: number };
  exportedAt: string;
}

export interface ImportReport {
  projectsAdded: number;
  projectsSkipped: number;
  visualisationsAdded: number;
  visualisationsSkipped: number;
}

/** Result of parsing raw user input into tabular data. */
export interface IngestResult {
  dataset: Dataset;
  warnings: string[];
  source: {
    kind: "csv" | "json";
    name?: string;
    mimeType?: string;
    size: number;
  };
}
