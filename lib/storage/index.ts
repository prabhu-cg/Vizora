export * from "./errors";
export * from "./types";
export * from "./change-bus";
export { IndexedDbStorage } from "./indexeddb-storage";
export { serializeBackup, backupFilename, parseBackupText } from "./backup-file";

import { IndexedDbStorage } from "./indexeddb-storage";
import type { VizoraStorage } from "./types";

let instance: VizoraStorage | undefined;

/** Browser singleton. Never call during SSR. */
export function getStorage(): VizoraStorage {
  instance ??= new IndexedDbStorage();
  return instance;
}
