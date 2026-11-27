import { describe, expect, it } from "vitest";
import { createEntitlementService } from "@/features/entitlements";
import { documentFromInterpretation, interpret, updateNode } from "@/lib/engine";
import { createExportManager } from "@/lib/export";
import { parseBackupText, serializeBackup, IndexedDbStorage } from "@/lib/storage";
import { parseVisualisation } from "@/lib/visualisation/migrations";
import { IDBFactory } from "fake-indexeddb";

/**
 * The F5 acceptance journey, end to end on the real storage, engine and export code:
 * no account, no server, no database service, no AI.
 */
describe("a new user can complete the whole journey", () => {
  it("open, create a project, generate, edit, save, refresh, export, back up, restore", async () => {
    const factory = new IDBFactory();
    // 1-2. Open Vizora (first visit: empty) and create a project.
    let storage = new IndexedDbStorage(factory, "vizora");
    expect(await storage.projects.list()).toEqual([]);
    const project = await storage.projects.create({ name: "Onboarding", description: "First project" });

    // 3. Generate a visualisation from text.
    const text = "1. Sign up\n2. If verified, activate, otherwise resend\n3. Welcome";
    const doc = documentFromInterpretation(text, interpret(text, { type: "flowchart" }));
    expect(doc.nodes.length).toBeGreaterThanOrEqual(3);
    const created = await storage.visualisations.create(project.id, doc);

    // 4-5. Edit it and save.
    const target = created.document.nodes.find((n) => n.label === "Sign up")!;
    const edited = updateNode(created.document, target.id, { label: "Register" });
    const saved = await storage.visualisations.save(created.id, edited, { expectedRevision: created.revision });
    expect(saved.revision).toBe(created.revision + 1);

    // 6. Refresh the browser: a brand-new storage object on the same database finds the work.
    storage = new IndexedDbStorage(factory, "vizora");
    const reopened = await storage.visualisations.get(created.id);
    expect(reopened!.document.nodes.map((n) => n.label)).toContain("Register");
    expect((await storage.projects.list()).map((p) => p.name)).toEqual(["Onboarding"]);

    // 7. Export it, in every format that applies.
    const manager = createExportManager(createEntitlementService());
    const formats = manager.available(reopened!.document).map((e) => e.id);
    expect(formats).toEqual(expect.arrayContaining(["svg", "html-embed", "vizora-json"]));
    const svg = await manager.export("svg", reopened!.document);
    expect(await svg.blob.text()).toContain("Register");
    const json = await manager.export("vizora-json", reopened!.document);
    expect(parseVisualisation(JSON.parse(await json.blob.text())).nodes).toHaveLength(reopened!.document.nodes.length);

    // 8. Back up the project to a file, lose everything, and restore from the file.
    const file = serializeBackup(await storage.backup.exportProject(project.id));
    await storage.data.clearAll();
    expect(await storage.projects.list()).toEqual([]);
    const restored = new IndexedDbStorage(new IDBFactory(), "vizora");
    const raw = parseBackupText(file);
    const preview = await restored.backup.preview(raw);
    expect(preview.projects.new).toBe(1);
    await restored.backup.import(raw, "skip");
    const back = await restored.projects.list();
    expect(back.map((p) => p.name)).toEqual(["Onboarding"]);
    const items = await restored.visualisations.listByProject(back[0]!.id);
    expect(items).toHaveLength(1);
    expect((await restored.visualisations.get(items[0]!.id))!.document.nodes.map((n) => n.label)).toContain("Register");
  });

  it("needs no registration, subscription or network: the Free plan allows every step", () => {
    const e = createEntitlementService();
    for (const f of ["projects.manage", "export.svg", "export.png", "export.json", "data.import.csv"] as const) expect(e.can(f), f).toBe(true);
  });
});
