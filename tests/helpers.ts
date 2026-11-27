import { IDBFactory } from "fake-indexeddb";
import { IndexedDbStorage } from "@/lib/storage/indexeddb-storage";
import { createVisualisation } from "@/lib/visualisation/factory";

/** Fresh isolated database per test. */
export function createTestStorage(): IndexedDbStorage {
  return new IndexedDbStorage(new IDBFactory(), "vizora-test");
}

export function sampleDoc(title = "Sample") {
  return createVisualisation({ title, type: "flowchart" });
}
