import type { BackupEnvelope } from "@/types/data";
import { BackupError } from "./errors";

export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

export function serializeBackup(backup: BackupEnvelope): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFilename(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `vizora-backup-${stamp}.json`;
}

export function parseBackupText(text: string): unknown {
  if (text.length > MAX_BACKUP_BYTES) throw new BackupError("This backup file is too large to import.");
  try {
    return JSON.parse(text);
  } catch {
    throw new BackupError("This file is not valid JSON, so it cannot be a VIZORA backup.");
  }
}

/** vizora-project-my-plan-2026-11-27-13-05-09.json */
export function projectBackupFilename(name: string, now: Date = new Date()): string {
  const slug = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "project";
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `vizora-project-${slug}-${stamp}.json`;
}
