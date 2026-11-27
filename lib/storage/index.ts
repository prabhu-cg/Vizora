export * from "./errors";
export * from "./types";
export * from "./change-bus";
export { IndexedDbStorage } from "./indexeddb-storage";
export { serializeBackup, backupFilename, projectBackupFilename, parseBackupText } from "./backup-file";
export { compareByCustomOrder, nextOrder } from "./order";

import { IndexedDbStorage } from "./indexeddb-storage";
import type { VizoraStorage } from "./types";

let instance: VizoraStorage | undefined;

/** Browser singleton. Never call during SSR. */
export function getStorage(): VizoraStorage {
  instance ??= new IndexedDbStorage();
  return instance;
}
