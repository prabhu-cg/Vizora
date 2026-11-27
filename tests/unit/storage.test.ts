import { describe, expect, it } from "vitest";
import { ConflictError, NotFoundError } from "@/lib/storage";
import { createNode } from "@/lib/visualisation/factory";
import { createTestStorage, sampleDoc } from "../helpers";

describe("projects", () => {
  it("creates, reads, updates and lists projects", async () => {
    const s = createTestStorage();
    const p = await s.projects.create({ name: "  Alpha  ", description: "first" });
    expect(p.name).toBe("Alpha");
    expect(await s.projects.get(p.id)).toEqual(p);

    const updated = await s.projects.update(p.id, { name: "Beta" });
    expect(updated.name).toBe("Beta");
    expect(updated.createdAt).toBe(p.createdAt);
    expect(updated.updatedAt >= p.updatedAt).toBe(true);
    expect((await s.projects.list()).map((x) => x.name)).toEqual(["Beta"]);
  });

  it("rejects blank names and unknown ids", async () => {
    const s = createTestStorage();
    await expect(s.projects.create({ name: "   " })).rejects.toThrow(/required/i);
    await expect(s.projects.update("nope", { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    expect(await s.projects.get("nope")).toBeUndefined();
  });

  it("deletes a project together with its visualisations, atomically", async () => {
    const s = createTestStorage();
    const a = await s.projects.create({ name: "A" });
    const b = await s.projects.create({ name: "B" });
    await s.visualisations.create(a.id, sampleDoc("a1"));
    await s.visualisations.create(a.id, sampleDoc("a2"));
    const keep = await s.visualisations.create(b.id, sampleDoc("b1"));

    expect(await s.projects.delete(a.id)).toEqual({ deletedVisualisations: 2 });
    expect(await s.projects.get(a.id)).toBeUndefined();
    expect(await s.visualisations.listByProject(a.id)).toEqual([]);
    expect((await s.visualisations.listAll()).map((v) => v.id)).toEqual([keep.id]);
    await expect(s.projects.delete(a.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("visualisations", () => {
  it("requires an existing project", async () => {
    const s = createTestStorage();
    await expect(s.visualisations.create("missing", sampleDoc())).rejects.toBeInstanceOf(NotFoundError);
  });

  it("saves, loads, and increments revision", async () => {
    const s = createTestStorage();
    const p = await s.projects.create({ name: "P" });
    const rec = await s.visualisations.create(p.id, sampleDoc("One"));
    expect(rec.revision).toBe(1);

    const doc = { ...rec.document, title: "Two", nodes: [createNode({ position: { x: 1, y: 2 } })] };
    const saved = await s.visualisations.save(rec.id, doc, { expectedRevision: 1 });
    expect(saved.revision).toBe(2);

    const loaded = await s.visualisations.get(rec.id);
    expect(loaded?.document.title).toBe("Two");
    expect(loaded?.document.nodes).toHaveLength(1);
    expect(loaded?.document.createdAt).toBe(rec.document.createdAt);
  });

  it("never silently overwrites: stale saves throw ConflictError with the current copy", async () => {
    const s = createTestStorage();
    const p = await s.projects.create({ name: "P" });
    const rec = await s.visualisations.create(p.id, sampleDoc("Base"));
    await s.visualisations.save(rec.id, { ...rec.document, title: "Tab A" }, { expectedRevision: 1 });

    const err = await s.visualisations
      .save(rec.id, { ...rec.document, title: "Tab B" }, { expectedRevision: 1 })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).current.document.title).toBe("Tab A");
    expect((await s.visualisations.get(rec.id))?.document.title).toBe("Tab A");

    const forced = await s.visualisations.save(rec.id, { ...rec.document, title: "Tab B" }, { expectedRevision: 1, overwrite: true });
    expect(forced.document.title).toBe("Tab B");
    expect(forced.revision).toBe(3);
  });

  it("refuses to persist documents that fail validation", async () => {
    const s = createTestStorage();
    const p = await s.projects.create({ name: "P" });
    const rec = await s.visualisations.create(p.id, sampleDoc());
    const bad = {
      ...rec.document,
      edges: [{ id: "e", source: "ghost", target: "ghost2" }],
    };
    await expect(s.visualisations.save(rec.id, bad, { expectedRevision: 1 })).rejects.toThrow(/missing node/);
    expect((await s.visualisations.get(rec.id))?.revision).toBe(1);
  });

  it("duplicates with a new id, a copy title, and no shared state", async () => {
    const s = createTestStorage();
    const p = await s.projects.create({ name: "P" });
    const rec = await s.visualisations.create(p.id, {
      ...sampleDoc("Orig"),
      nodes: [createNode({ id: "n1", position: { x: 0, y: 0 } })],
    });
    const copy = await s.visualisations.duplicate(rec.id);
    expect(copy.id).not.toBe(rec.id);
    expect(copy.document.id).toBe(copy.id);
    expect(copy.document.title).toBe("Orig (copy)");
    expect(copy.projectId).toBe(p.id);
    expect(copy.revision).toBe(1);
    expect(copy.document.nodes).toEqual(rec.document.nodes);
    expect((await s.visualisations.listByProject(p.id)).map((v) => v.title).sort()).toEqual(["Orig", "Orig (copy)"]);
  });

  it("deletes a visualisation", async () => {
    const s = createTestStorage();
    const p = await s.projects.create({ name: "P" });
    const rec = await s.visualisations.create(p.id, sampleDoc());
    await s.visualisations.delete(rec.id);
    expect(await s.visualisations.get(rec.id)).toBeUndefined();
    await expect(s.visualisations.delete(rec.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("summaries expose counts without loading documents", async () => {
    const s = createTestStorage();
    const p = await s.projects.create({ name: "P" });
    await s.visualisations.create(p.id, { ...sampleDoc(), nodes: [createNode({ position: { x: 0, y: 0 } })] });
    const [summary] = await s.visualisations.listByProject(p.id);
    expect(summary).toMatchObject({ nodeCount: 1, datasetCount: 0, type: "diagram" });
  });
});

describe("persistence across connections (recover after refresh)", () => {
  it("a new storage instance on the same database sees prior data", async () => {
    const { IDBFactory } = await import("fake-indexeddb");
    const { IndexedDbStorage } = await import("@/lib/storage");
    const factory = new IDBFactory();
    const first = new IndexedDbStorage(factory, "refresh");
    const p = await first.projects.create({ name: "Persisted" });
    const rec = await first.visualisations.create(p.id, sampleDoc("Survives"));
    first.close();

    const second = new IndexedDbStorage(factory, "refresh");
    expect((await second.projects.get(p.id))?.name).toBe("Persisted");
    expect((await second.visualisations.get(rec.id))?.document.title).toBe("Survives");
  });
});

describe("change notifications", () => {
  it("notifies subscribers of writes", async () => {
    const s = createTestStorage();
    const events: string[] = [];
    const off = s.subscribe((e) => events.push(e.scope));
    const p = await s.projects.create({ name: "P" });
    await s.visualisations.create(p.id, sampleDoc());
    off();
    await s.projects.update(p.id, { name: "Q" });
    expect(events).toEqual(["projects", "visualisations"]);
  });
});
