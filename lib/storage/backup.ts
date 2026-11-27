import { BACKUP_FORMAT, CURRENT_BACKUP_VERSION, backupEnvelopeSchema, formatZodError, parseProject, SchemaVersionError } from "@/lib/validation";
import { parseVisualisation } from "@/lib/visualisation/migrations";
import { nowIso } from "@/lib/utils/time";
import type { BackupEnvelope } from "@/types/data";
import type { Project } from "@/types/project";
import type { VisualisationIR } from "@/types/visualisation";
import { BackupError } from "./errors";
import { fromStored, orderOfStored } from "./records";

export interface ParsedBackup {
  exportedAt: string;
  projects: Project[];
  visualisations: { id: string; projectId: string; document: VisualisationIR; order?: number }[];
}

export function buildBackup(rawProjects: unknown[], rawVisualisations: unknown[]): BackupEnvelope {
  try {
    return {
      format: BACKUP_FORMAT,
      backupVersion: CURRENT_BACKUP_VERSION,
      exportedAt: nowIso(),
      app: { name: "VIZORA", edition: "free" },
      projects: rawProjects.map(parseProject),
      visualisations: rawVisualisations.map((raw) => {
        const record = fromStored(raw);
        const order = orderOfStored(raw);
        return { id: record.id, projectId: record.projectId, document: record.document, ...(order !== undefined ? { order } : {}) };
      }),
    };
  } catch (cause) {
    throw new BackupError(
      `Backup aborted because a record could not be read, and an incomplete backup would be misleading. ${cause instanceof Error ? cause.message : ""}`.trim(),
    );
  }
}

/** Fully validate a backup (envelope, migrations, references) before anything is written. */
export function readBackup(raw: unknown): ParsedBackup {
  if (typeof raw === "object" && raw !== null && (raw as { format?: unknown }).format !== BACKUP_FORMAT) {
    throw new BackupError("This file is not a VIZORA backup.");
  }
  const version = (raw as { backupVersion?: unknown } | null)?.backupVersion;
  if (typeof version === "number" && version > CURRENT_BACKUP_VERSION) {
    throw new BackupError("This backup was created by a newer version of VIZORA. Update VIZORA to import it.");
  }
  const envelope = backupEnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    throw new BackupError(`This file is not a valid VIZORA backup: ${formatZodError(envelope.error)}`);
  }

  try {
    const projects = envelope.data.projects.map(parseProject);
    const projectIds = new Set<string>();
    for (const p of projects) {
      if (projectIds.has(p.id)) throw new BackupError(`Backup contains duplicate project id "${p.id}".`);
      projectIds.add(p.id);
    }
    const seen = new Set<string>();
    const visualisations = envelope.data.visualisations.map((item) => {
      const document = parseVisualisation(item.document);
      if (document.id !== item.id) throw new BackupError(`Visualisation "${item.id}" has a mismatched document id.`);
      if (seen.has(item.id)) throw new BackupError(`Backup contains duplicate visualisation id "${item.id}".`);
      seen.add(item.id);
      if (!projectIds.has(item.projectId)) {
        throw new BackupError(`Visualisation "${document.title}" belongs to a project that is not in the backup.`);
      }
      return { id: item.id, projectId: item.projectId, document, ...(item.order !== undefined ? { order: item.order } : {}) };
    });
    return { exportedAt: envelope.data.exportedAt, projects, visualisations };
  } catch (cause) {
    if (cause instanceof BackupError) throw cause;
    if (cause instanceof SchemaVersionError || cause instanceof Error) {
      throw new BackupError(cause.message);
    }
    throw cause;
  }
}
