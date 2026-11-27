import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { BackupError, ConflictError, IndexedDbStorage, NotFoundError, StorageError } from "@/lib/storage";
import { openDatabase, requestToPromise, STORES } from "@/lib/storage/database";
import { compareByCustomOrder, nextOrder } from "@/lib/storage/order";
import { createVisualisation } from "@/lib/visualisation/factory";
import { createTestStorage, sampleDoc } from "../helpers";

const titles = async (s: IndexedDbStorage, projectId: string) =>
  (await s.visualisations.listByProject(projectId)).sort(compareByCustomOrder).map((v) => v.title);
const orderedIds = async (s: IndexedDbStorage, projectId: string) =>
  (await s.visualisations.listByProject(projectId)).sort(compareByCustomOrder).map((v) => v.id);
const tick = () => new Promise((r) => setTimeout(r, 5));

async function library() {
  const s = createTestStorage();
  const a = await s.projects.create({ name: "Alpha", description: "first" });
  const b = await s.projects.create({ name: "Beta" });
  const one = await s.visualisations.create(a.id, sampleDoc("One"));
  const two = await s.visualisations.create(a.id, sampleDoc("Two"));
  const three = await s.visualisations.create(a.id, sampleDoc("Three"));
  return { s, a, b, one, two, three };
}

describe("custom order", () => {
  it("new visualisations are appended; legacy records without an order sort first, oldest first", () => {
    const items = [{ order: 3, createdAt: "2026-01-03" }, { createdAt: "2026-01-02" }, { order: 1, createdAt: "2026-01-09" }, { createdAt: "2026-01-01" }];
    expect([...items].sort(compareByCustomOrder).map((i) => i.createdAt)).toEqual(["2026-01-01", "2026-01-02", "2026-01-09", "2026-01-03"]);
    expect(nextOrder([])).toBe(0);
    expect(nextOrder([{}, { order: 4 }, { order: 2 }])).toBe(5);
  });

  it("creating appends in order", async () => {
    const { s, a } = await library();
    expect(await titles(s, a.id)).toEqual(["One", "Two", "Three"]);
    const four = await s.visualisations.create(a.id, sampleDoc("Four"));
    expect(await titles(s, a.id)).toEqual(["One", "Two", "Three", "Four"]);
    expect((await s.visualisations.listByProject(a.id)).find((v) => v.id === four.id)!.order).toBe(3);
  });

  it("reorder persists, and survives a reload of the database", async () => {
    const factory = new IDBFactory();
    const first = new IndexedDbStorage(factory, "ord");
    const p = await first.projects.create({ name: "P" });
    const ids = [] as string[];
    for (const t of ["A", "B", "C"]) ids.push((await first.visualisations.create(p.id, sampleDoc(t))).id);
    await first.visualisations.reorder(p.id, [ids[2]!, ids[0]!, ids[1]!]);
    first.close();
    const again = new IndexedDbStorage(factory, "ord");
    expect(await titles(again, p.id)).toEqual(["C", "A", "B"]);
  });

  it("reorder refuses a stale or invalid list instead of guessing", async () => {
    const { s, a, one, two, three } = await library();
    await expect(s.visualisations.reorder(a.id, [one.id, two.id])).rejects.toThrow(/changed while you were reordering/); // one missing
    await expect(s.visualisations.reorder(a.id, [one.id, two.id, three.id, "ghost"])).rejects.toBeInstanceOf(StorageError);
    await expect(s.visualisations.reorder(a.id, [one.id, one.id, two.id])).rejects.toBeInstanceOf(StorageError);
    expect(await titles(s, a.id)).toEqual(["One", "Two", "Three"]); // nothing changed
  });

  it("older records without an order still list, then a reorder numbers them all", async () => {
    const factory = new IDBFactory();
    const db = await openDatabase(factory, "legacy-order");
    const mk = (id: string, created: string) => ({
      id, projectId: "p", revision: 1,
      meta: { title: id, description: "", type: "flowchart", nodeCount: 0, datasetCount: 0, createdAt: created, updatedAt: created },
      document: { ...createVisualisation({ title: id, type: "flowchart" }), id, createdAt: created, updatedAt: created },
    });
    const tx = db.transaction([STORES.projects, STORES.visualisations], "readwrite");
    await requestToPromise(tx.objectStore(STORES.projects).put({ id: "p", schemaVersion: 1, name: "Old", description: "", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }));
    for (const [id, c] of [["late", "2026-03-01T00:00:00.000Z"], ["early", "2026-01-01T00:00:00.000Z"]] as const) await requestToPromise(tx.objectStore(STORES.visualisations).put(mk(id, c)));
    await new Promise<void>((r) => (tx.oncomplete = () => r()));
    db.close();

    const s = new IndexedDbStorage(factory, "legacy-order");
    const fresh = await s.visualisations.create("p", sampleDoc("fresh"));
    // legacy first (oldest first), then the new one
    const listed = await s.visualisations.listByProject("p");
    expect(listed.map((v) => [v.title, v.order])).toEqual(expect.arrayContaining([["fresh", 0]]));
    await s.visualisations.reorder("p", ["early", "late", fresh.id]);
    expect((await s.visualisations.listByProject("p")).map((v) => v.order).sort()).toEqual([0, 1, 2]);
  });
});

describe("a project's modified time follows its contents", () => {
  it("creating, saving, deleting and moving visualisations all update it", async () => {
    const { s, a, b, one, three } = await library();
    const t0 = (await s.projects.get(a.id))!.updatedAt;
    await tick();
    await s.visualisations.save(one.id, { ...one.document, title: "One!" }, { expectedRevision: 1 });
    const t1 = (await s.projects.get(a.id))!.updatedAt;
    expect(t1 > t0).toBe(true);
    await tick();
    await s.visualisations.delete(three.id);
    const t2 = (await s.projects.get(a.id))!.updatedAt;
    expect(t2 > t1).toBe(true);
    const bBefore = (await s.projects.get(b.id))!.updatedAt;
    await tick();
    await s.visualisations.move(one.id, b.id);
    expect((await s.projects.get(b.id))!.updatedAt > bBefore).toBe(true);
    expect((await s.projects.get(a.id))!.updatedAt > t2).toBe(true);
  });
  it("renaming a project does not need contents to change", async () => {
    const { s, a } = await library();
    const renamed = await s.projects.update(a.id, { name: "Alpha 2" });
    expect(renamed.name).toBe("Alpha 2");
  });
});

describe("duplicate", () => {
  it("a visualisation lands directly after the original and orders stay contiguous", async () => {
    const { s, a, one } = await library();
    const copy = await s.visualisations.duplicate(one.id);
    expect(await titles(s, a.id)).toEqual(["One", "One (copy)", "Two", "Three"]);
    expect((await s.visualisations.listByProject(a.id)).map((v) => v.order).sort((x, y) => x! - y!)).toEqual([0, 1, 2, 3]);
    expect(copy.revision).toBe(1);
  });
  it("a project is copied with all its visualisations: new ids, same order, independent", async () => {
    const { s, a, one } = await library();
    await s.visualisations.reorder(a.id, (await orderedIds(s, a.id)).reverse());
    const { project, visualisations } = await s.projects.duplicate(a.id);
    expect(visualisations).toBe(3);
    expect(project).toMatchObject({ name: "Alpha (copy)", description: "first" });
    expect(project.id).not.toBe(a.id);
    expect(await titles(s, project.id)).toEqual(["Three", "Two", "One"]);
    const originals = new Set((await s.visualisations.listByProject(a.id)).map((v) => v.id));
    const copies = await s.visualisations.listByProject(project.id);
    expect(copies.every((c) => !originals.has(c.id))).toBe(true);
    // editing the copy does not touch the original
    const rec = (await s.visualisations.get(copies[0]!.id))!;
    expect(rec.document.id).toBe(rec.id);
    await s.visualisations.save(rec.id, { ...rec.document, title: "Changed" }, { expectedRevision: 1 });
    expect((await s.visualisations.get(one.id))!.document.title).toBe("One");
    await expect(s.projects.duplicate("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("move between projects", () => {
  it("moves to the end of the target and leaves content and revision alone", async () => {
    const { s, a, b, one, two } = await library();
    await s.visualisations.create(b.id, sampleDoc("B1"));
    const moved = await s.visualisations.move(one.id, b.id);
    expect(moved.projectId).toBe(b.id);
    expect(moved.revision).toBe(one.revision);
    expect(await titles(s, b.id)).toEqual(["B1", "One"]);
    expect(await titles(s, a.id)).toEqual(["Two", "Three"]);
    expect((await s.visualisations.get(one.id))!.document).toEqual(one.document);
    expect((await s.visualisations.get(two.id))!.projectId).toBe(a.id);
  });
  it("is a no-op within the same project and refuses a missing target", async () => {
    const { s, a, one } = await library();
    expect((await s.visualisations.move(one.id, a.id)).projectId).toBe(a.id);
    await expect(s.visualisations.move(one.id, "ghost")).rejects.toBeInstanceOf(NotFoundError);
    await expect(s.visualisations.move("ghost", a.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await s.visualisations.get(one.id))!.projectId).toBe(a.id);
  });
  it("an editor that was open on the item can still save after the move, into the new project", async () => {
    const { s, b, one } = await library();
    await s.visualisations.move(one.id, b.id);
    const saved = await s.visualisations.save(one.id, { ...one.document, title: "Edited after move" }, { expectedRevision: one.revision });
    expect(saved.projectId).toBe(b.id);
  });
});

describe("renaming never overwrites someone else's change", () => {
  it("a stale rename is a conflict, with the current copy", async () => {
    const { s, one } = await library();
    await s.visualisations.save(one.id, { ...one.document, title: "Other tab" }, { expectedRevision: 1 });
    const err = await s.visualisations.save(one.id, { ...one.document, title: "My rename" }, { expectedRevision: 1 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((await s.visualisations.get(one.id))!.document.title).toBe("Other tab");
  });
});

describe("project backup", () => {
  it("exports one project with its visualisations and arrangement, in the normal backup format", async () => {
    const { s, a, b, one } = await library();
    await s.visualisations.create(b.id, sampleDoc("Elsewhere"));
    await s.visualisations.reorder(a.id, (await orderedIds(s, a.id)).reverse());
    const backup = await s.backup.exportProject(a.id);
    expect(backup.projects.map((p) => (p as { name: string }).name)).toEqual(["Alpha"]);
    expect(backup.visualisations).toHaveLength(3);
    expect(backup.visualisations.every((v) => v.projectId === a.id)).toBe(true);
    expect(backup.visualisations.some((v) => v.id === one.id)).toBe(true);
    await expect(s.backup.exportProject("ghost")).rejects.toBeInstanceOf(NotFoundError);

    // restores into a fresh library with the same arrangement
    const target = createTestStorage();
    const report = await target.backup.import(JSON.parse(JSON.stringify(backup)), "skip");
    expect(report).toMatchObject({ projectsAdded: 1, visualisationsAdded: 3 });
    expect(await titles(target, a.id)).toEqual(["Three", "Two", "One"]);
  });
  it("is validated before anything is written: a damaged project backup changes nothing", async () => {
    const { s, a } = await library();
    const bad = JSON.parse(JSON.stringify(await s.backup.exportProject(a.id)));
    bad.visualisations[1].document.title = "";
    const target = createTestStorage();
    await expect(target.backup.import(bad, "skip")).rejects.toBeInstanceOf(BackupError);
    expect(await target.projects.list()).toEqual([]);
    const orphan = JSON.parse(JSON.stringify(await s.backup.exportProject(a.id)));
    orphan.projects = [];
    await expect(target.backup.import(orphan, "skip")).rejects.toThrow(/not in the backup/);
  });
  it("importing a project that already exists never overwrites it: skip leaves it, keep-both adds a labelled copy", async () => {
    const { s, a } = await library();
    const backup = await s.backup.exportProject(a.id);
    await s.projects.update(a.id, { name: "Renamed since" });
    const skipped = await s.backup.import(backup, "skip");
    expect(skipped).toMatchObject({ projectsAdded: 0, projectsSkipped: 1, visualisationsAdded: 0, visualisationsSkipped: 3 });
    expect((await s.projects.get(a.id))!.name).toBe("Renamed since");
    const both = await s.backup.import(backup, "keep-both");
    expect(both).toMatchObject({ projectsAdded: 1, visualisationsAdded: 3 });
    expect((await s.projects.list()).map((p) => p.name).sort()).toEqual(["Alpha (imported)", "Beta", "Renamed since"]);
  });
  it("the preview names what is in the file and what already exists here", async () => {
    const { s, a } = await library();
    const backup = await s.backup.exportProject(a.id);
    const fresh = await createTestStorage().backup.preview(backup);
    expect(fresh.conflicts).toEqual([]);
    expect(fresh.contents).toEqual([{ id: a.id, name: "Alpha", visualisations: 3, exists: false }]);
    const here = await s.backup.preview(backup);
    expect(here.contents[0]).toMatchObject({ name: "Alpha", exists: true });
    expect(here.conflicts.map((c) => `${c.kind}:${c.name}`).sort()).toEqual(["project:Alpha", "visualisation:One", "visualisation:Three", "visualisation:Two"]);
    expect(here.projects).toMatchObject({ total: 1, existing: 1, new: 0 });
  });
});

describe("storage information and clearing", () => {
  it("counts projects, visualisations and datasets, with an approximate size and a breakdown", async () => {
    const { s, a, b } = await library();
    const big = { ...sampleDoc("Big"), data: { datasets: [{ id: "d", name: "d", columns: [{ key: "x", label: "x", type: "string" as const }], rows: Array.from({ length: 300 }, (_, i) => ({ x: `row ${i} ${"y".repeat(40)}` })) }] } };
    await s.visualisations.create(b.id, big);
    const stats = await s.data.stats();
    expect(stats).toMatchObject({ projects: 2, visualisations: 4, datasets: 1 });
    expect(stats.bytes).toBeGreaterThan(10_000);
    expect(stats.perProject.map((p) => p.name)).toEqual(["Beta", "Alpha"]); // largest first
    expect(stats.perProject.find((p) => p.id === a.id)!.visualisations).toBe(3);
    expect(stats.largest[0]).toMatchObject({ title: "Big" });
    expect(stats.perProject.reduce((n, p) => n + p.bytes, 0)).toBeLessThanOrEqual(stats.bytes);
  });
  it("an empty library reports zeros", async () => {
    expect(await createTestStorage().data.stats()).toMatchObject({ projects: 0, visualisations: 0, datasets: 0 });
  });
  it("clearAll removes everything and tells subscribers", async () => {
    const { s } = await library();
    const events: string[] = [];
    s.subscribe((e) => events.push(e.scope));
    await s.data.clearAll();
    expect(await s.projects.list()).toEqual([]);
    expect(await s.visualisations.listAll()).toEqual([]);
    expect(events).toEqual(["all"]);
    // and the library is usable again
    const p = await s.projects.create({ name: "Fresh" });
    expect((await s.projects.get(p.id))!.name).toBe("Fresh");
  });
});
