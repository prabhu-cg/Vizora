import type { VisualisationRecord } from "@/types/visualisation";

export class StorageError extends Error {
  override name = "StorageError";
}

/** IndexedDB is missing or blocked (private mode, disabled storage, SSR). */
export class StorageUnavailableError extends StorageError {
  override name = "StorageUnavailableError";
}

export class NotFoundError extends StorageError {
  override name = "NotFoundError";
  constructor(readonly entity: "project" | "visualisation", readonly id: string) {
    super(`The ${entity} no longer exists.`);
  }
}

/** The stored copy changed since it was loaded (another tab, or a restored backup). */
export class ConflictError extends StorageError {
  override name = "ConflictError";
  constructor(readonly current: VisualisationRecord) {
    super("This visualisation was changed elsewhere since you opened it.");
  }
}

export class QuotaExceededError extends StorageError {
  override name = "QuotaExceededError";
  constructor() {
    super("Browser storage is full. Export a backup and free some space, then try again.");
  }
}

export class BackupError extends StorageError {
  override name = "BackupError";
}
