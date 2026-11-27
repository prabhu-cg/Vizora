import { downloadBlob } from "@/lib/export";
import { backupFilename, projectBackupFilename, serializeBackup, type VizoraStorage } from "@/lib/storage";
import type { BackupEnvelope } from "@/types/data";

const save = (filename: string, backup: BackupEnvelope) => downloadBlob(filename, new Blob([serializeBackup(backup)], { type: "application/json" }));

/** Download everything in this browser as one backup file. */
export async function downloadFullBackup(storage: VizoraStorage): Promise<BackupEnvelope> {
  const backup = await storage.backup.export();
  save(backupFilename(), backup);
  return backup;
}

/** Download one project (with its visualisations and their order) as a backup file that can be imported again. */
export async function downloadProjectBackup(storage: VizoraStorage, project: { id: string; name: string }): Promise<BackupEnvelope> {
  const backup = await storage.backup.exportProject(project.id);
  save(projectBackupFilename(project.name), backup);
  return backup;
}

export function describeBackup(b: Pick<BackupEnvelope, "projects" | "visualisations">): string {
  const p = b.projects.length, v = b.visualisations.length;
  return `${p} project${p === 1 ? "" : "s"}, ${v} visualisation${v === 1 ? "" : "s"}`;
}
