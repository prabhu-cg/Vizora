import type { z } from "zod";
import type { backupEnvelopeSchema } from "@/lib/validation/backup.schema";
import type { Dataset } from "@/types/visualisation";

export type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>;

export type ConflictPolicy = "skip" | "keep-both";

export interface BackupPreview {
  projects: { total: number; new: number; existing: number };
  visualisations: { total: number; new: number; existing: number };
  exportedAt: string;
  /** What the file contains, so people can see what they are about to import. */
  contents: { id: string; name: string; visualisations: number; exists: boolean }[];
  /** Items that already exist here, by name, so a conflict is never abstract. */
  conflicts: { kind: "project" | "visualisation"; id: string; name: string }[];
}

export interface StorageStats {
  projects: number;
  visualisations: number;
  datasets: number;
  /** Approximate size of everything Vizora stores, measured from the stored records. */
  bytes: number;
  perProject: { id: string; name: string; visualisations: number; bytes: number }[];
  largest: { id: string; title: string; bytes: number }[];
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
