import { QuotaExceededError, StorageError, StorageUnavailableError } from "./errors";

export const DB_NAME = "vizora";
export const DB_VERSION = 1;

export const STORES = {
  projects: "projects",
  visualisations: "visualisations",
} as const;

/**
 * Upgrade steps keyed by the version they upgrade *to*. Add a new entry and
 * bump DB_VERSION for any structural change (new store, index). Document
 * content changes belong in the schema migrations instead.
 */
const upgrades: Record<number, (db: IDBDatabase, tx: IDBTransaction) => void> = {
  1: (db) => {
    db.createObjectStore(STORES.projects, { keyPath: "id" });
    const viz = db.createObjectStore(STORES.visualisations, { keyPath: "id" });
    viz.createIndex("byProject", "projectId", { unique: false });
  },
};

export function openDatabase(
  factory: IDBFactory | undefined = globalThis.indexedDB,
  name: string = DB_NAME,
): Promise<IDBDatabase> {
  if (!factory) {
    return Promise.reject(
      new StorageUnavailableError(
        "Local storage (IndexedDB) is not available in this browser or mode. VIZORA needs it to save your work.",
      ),
    );
  }
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(name, DB_VERSION);
    } catch (cause) {
      reject(new StorageUnavailableError(`Could not open local storage: ${describe(cause)}`));
      return;
    }
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;
      if (!tx) return;
      for (let v = event.oldVersion + 1; v <= (event.newVersion ?? DB_VERSION); v++) {
        upgrades[v]?.(db, tx);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Let a newer tab upgrade the schema instead of blocking on this connection.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () =>
      reject(new StorageUnavailableError(`Could not open local storage: ${describe(request.error)}`));
    request.onblocked = () =>
      reject(new StorageUnavailableError("Local storage is blocked by another open VIZORA tab. Close other tabs and reload."));
  });
}

export function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause ?? "unknown error");
}

export function toStorageError(cause: unknown): StorageError {
  if (cause instanceof StorageError) return cause;
  if (cause instanceof DOMException && cause.name === "QuotaExceededError") {
    return new QuotaExceededError();
  }
  return new StorageError(describe(cause));
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(toStorageError(request.error));
  });
}

/**
 * Run `work` inside one transaction. Resolves only once the transaction has
 * committed (not merely when the last request succeeded), so a resolved write
 * is durable. Any throw aborts the whole transaction: all-or-nothing.
 */
export function withTransaction<T>(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(stores, mode);
    } catch (cause) {
      reject(toStorageError(cause));
      return;
    }
    let result: T;
    let failure: unknown;
    let failed = false;
    tx.oncomplete = () => (failed ? reject(toStorageError(failure)) : resolve(result));
    tx.onabort = () =>
      reject(failed ? toStorageError(failure) : toStorageError(tx.error ?? new Error("Transaction aborted")));
    tx.onerror = () => undefined; // surfaced via onabort
    work(tx).then(
      (value) => {
        result = value;
      },
      (cause) => {
        failed = true;
        failure = cause;
        try {
          tx.abort();
        } catch {
          /* already finished */
        }
      },
    );
  });
}
