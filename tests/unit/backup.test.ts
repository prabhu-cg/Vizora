import { describe, expect, it } from "vitest";
import { BackupError, parseBackupText, serializeBackup, backupFilename } from "@/lib/storage";
import { createNode } from "@/lib/visualisation/factory";
import { createTestStorage, sampleDoc } from "../helpers";

async function seeded() {
  const s = createTestStorage();
  const p = await s.projects.create({ name: "Proj", description: "d" });
  const v = await s.visualisations.create(p.id, {
    ...sampleDoc("Viz"),
    nodes: [createNode({ id: "n1", position: { x: 3, y: 4 } })],
  });
  return { s, p, v };
}

describe("backup export/import", () => {
  it("round-trips through JSON text into an empty database", async () => {
    const { s, p, v } = await seeded();
    const text = serializeBackup(await s.backup.export());

    const target = createTestStorage();
    const report = await target.backup.import(parseBackupText(text), "skip");
    expect(report).toEqual({ projectsAdded: 1, projectsSkipped: 0, visualisationsAdded: 1, visualisationsSkipped: 0 });
    expect(await target.projects.get(p.id)).toEqual(p);
    expect((await target.visualisations.get(v.id))?.document).toEqual(v.document);
  });

  it("previews counts without writing", async () => {
    const { s } = await seeded();
    const backup = await s.backup.export();
    const empty = createTestStorage();
    expect(await empty.backup.preview(backup)).toMatchObject({
      projects: { total: 1, new: 1, existing: 0 },
      visualisations: { total: 1, new: 1, existing: 0 },
    });
    expect(await empty.projects.list()).toEqual([]);
    expect(await s.backup.preview(backup)).toMatchObject({ projects: { existing: 1 }, visualisations: { existing: 1 } });
  });

  it("never overwrites: 'skip' leaves existing records untouched", async () => {
    const { s, p, v } = await seeded();
    const backup = await s.backup.export();
    await s.projects.update(p.id, { name: "Edited locally" });
    await s.visualisations.save(v.id, { ...v.document, title: "Edited locally" }, { expectedRevision: 1 });

    const report = await s.backup.import(backup, "skip");
    expect(report).toMatchObject({ projectsAdded: 0, projectsSkipped: 1, visualisationsAdded: 0, visualisationsSkipped: 1 });
    expect((await s.projects.get(p.id))?.name).toBe("Edited locally");
    expect((await s.visualisations.get(v.id))?.document.title).toBe("Edited locally");
  });

  it("'keep-both' adds copies with fresh ids and links them together", async () => {
    const { s, p, v } = await seeded();
    const backup = await s.backup.export();
    const report = await s.backup.import(backup, "keep-both");
    expect(report).toMatchObject({ projectsAdded: 1, visualisationsAdded: 1 });

    const projects = await s.projects.list();
    expect(projects).toHaveLength(2);
    const copy = projects.find((x) => x.id !== p.id)!;
    expect(copy.name).toMatch(/\(imported\)$/);
    const copied = await s.visualisations.listByProject(copy.id);
    expect(copied).toHaveLength(1);
    expect(copied[0]!.id).not.toBe(v.id);
    expect((await s.visualisations.get(copied[0]!.id))?.document.id).toBe(copied[0]!.id);
    expect((await s.visualisations.get(v.id))?.revision).toBe(1);
  });

  it("is all-or-nothing: an invalid record aborts the whole import", async () => {
    const { s } = await seeded();
    const backup = await s.backup.export();
    const broken = structuredClone(backup);
    broken.visualisations[0]!.document = { ...(broken.visualisations[0]!.document as object), title: "" };
    const target = createTestStorage();
    await expect(target.backup.import(broken, "skip")).rejects.toThrow(BackupError);
    expect(await target.projects.list()).toEqual([]);
  });

  it("rejects non-backups, newer backups, orphans and malformed JSON", async () => {
    const s = createTestStorage();
    await expect(s.backup.import({ hello: "world" }, "skip")).rejects.toThrow(/not a VIZORA backup/);
    await expect(s.backup.import({ format: "vizora-backup", backupVersion: 99 }, "skip")).rejects.toThrow(/newer version/);
    expect(() => parseBackupText("{nope")).toThrow(/not valid JSON/);

    const { s: src } = await seeded();
    const orphan = await src.backup.export();
    orphan.projects = [];
    await expect(s.backup.import(orphan, "skip")).rejects.toThrow(/not in the backup/);
  });

  it("imports an older-schema (v0) visualisation by migrating it", async () => {
    const { s } = await seeded();
    const backup = await s.backup.export();
    const v0 = { id: backup.visualisations[0]!.id, title: "Old", nodes: [], edges: [] };
    backup.visualisations[0]!.document = v0;
    const target = createTestStorage();
    await target.backup.import(backup, "skip");
    const rec = await target.visualisations.get(v0.id);
    expect(rec?.document.schemaVersion).toBe(1);
    expect(rec?.document.title).toBe("Old");
  });

  it("names backup files with a sortable timestamp", () => {
    expect(backupFilename(new Date("2026-11-27T13:05:09Z"))).toBe("vizora-backup-2026-11-27-13-05-09.json");
  });
});
