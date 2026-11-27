import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { IndexedDbStorage } from "@/lib/storage";
import { openDatabase, requestToPromise, STORES } from "@/lib/storage/database";

/** What the F0/F1 build wrote: schema v1, type "diagram", node kind "default". */
const legacyRecord = (projectId: string) => {
  const document = {
    id: "legacy-1", schemaVersion: 1, title: "Old diagram", description: "from F0", type: "diagram", source: { kind: "manual" },
    nodes: [{ id: "a", type: "default", label: "A", position: { x: 0, y: 0 }, data: {} }, { id: "b", type: "default", label: "B", position: { x: 0, y: 100 }, data: {} }],
    edges: [{ id: "e", source: "a", target: "b" }], data: { datasets: [] }, configuration: { options: {} },
    layout: { algorithm: "manual", direction: "TB", spacing: { x: 80, y: 80 } }, viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-02T10:00:00.000Z",
  };
  return {
    id: "legacy-1", projectId, revision: 3,
    meta: { title: "Old diagram", description: "from F0", type: "diagram", nodeCount: 2, datasetCount: 0, createdAt: document.createdAt, updatedAt: document.updatedAt },
    document,
  };
};

async function seed() {
  const factory = new IDBFactory();
  const db = await openDatabase(factory, "legacy");
  const project = { id: "p1", schemaVersion: 1, name: "Old project", description: "", createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-01T10:00:00.000Z" };
  const tx = db.transaction([STORES.projects, STORES.visualisations], "readwrite");
  await requestToPromise(tx.objectStore(STORES.projects).put(project));
  await requestToPromise(tx.objectStore(STORES.visualisations).put(legacyRecord("p1")));
  await new Promise<void>((r) => (tx.oncomplete = () => r()));
  db.close();
  return new IndexedDbStorage(factory, "legacy");
}

describe("data written by earlier builds", () => {
  it("still appears in lists, as a flowchart", async () => {
    const s = await seed();
    const list = await s.visualisations.listByProject("p1");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "legacy-1", type: "flowchart", title: "Old diagram", nodeCount: 2 });
    expect((await s.visualisations.listAll()).map((v) => v.id)).toEqual(["legacy-1"]);
  });
  it("opens migrated to the current schema, without having been rewritten", async () => {
    const s = await seed();
    const rec = (await s.visualisations.get("legacy-1"))!;
    expect(rec.document).toMatchObject({ schemaVersion: 3, type: "flowchart" });
    expect(rec.document.nodes.map((n) => n.type)).toEqual(["process", "process"]);
    expect(rec.revision).toBe(3); // untouched until the user edits
  });
  it("saving it upgrades the stored copy and keeps listing correctly", async () => {
    const s = await seed();
    const rec = (await s.visualisations.get("legacy-1"))!;
    const saved = await s.visualisations.save(rec.id, { ...rec.document, title: "Renamed" }, { expectedRevision: rec.revision });
    expect(saved.revision).toBe(4);
    expect((await s.visualisations.listAll())[0]).toMatchObject({ title: "Renamed", type: "flowchart" });
  });
  it("is included in backups, which now carry the current schema", async () => {
    const s = await seed();
    const backup = await s.backup.export();
    expect(backup.visualisations[0]!.document).toMatchObject({ schemaVersion: 3, type: "flowchart" });
  });
  it("duplicates cleanly", async () => {
    const s = await seed();
    const copy = await s.visualisations.duplicate("legacy-1");
    expect(copy.document.type).toBe("flowchart");
    expect((await s.visualisations.listAll()).map((v) => v.type)).toEqual(["flowchart", "flowchart"]);
  });
});
