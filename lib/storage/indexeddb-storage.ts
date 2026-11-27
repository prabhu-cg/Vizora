import { createId } from "@/lib/utils/id";
import { nowIso } from "@/lib/utils/time";
import { parseVisualisation } from "@/lib/visualisation/migrations";
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  formatZodError,
  parseProject,
  projectDescriptionSchema,
  projectNameSchema,
} from "@/lib/validation";
import type { BackupPreview } from "@/types/data";
import type { Project, ProjectInput } from "@/types/project";
import type { VisualisationIR, VisualisationRecord, VisualisationSummary } from "@/types/visualisation";
import { readBackup, buildBackup } from "./backup";
import { ChangeBus, type ChangeListener } from "./change-bus";
import { openDatabase, requestToPromise, STORES, toStorageError, withTransaction } from "./database";
import { ConflictError, NotFoundError, StorageError } from "./errors";
import { compareByCustomOrder, nextOrder } from "./order";
import { fromStored, orderOfStored, summaryFromStored, toStored } from "./records";
import type { VizoraStorage } from "./types";

const MAX_TITLE = 200;

function byUpdatedDesc<T extends { updatedAt: string }>(a: T, b: T): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

function validateProjectInput(input: Partial<ProjectInput>): Partial<ProjectInput> {
  const out: Partial<ProjectInput> = {};
  if (input.name !== undefined) {
    const r = projectNameSchema.safeParse(input.name);
    if (!r.success) throw new StorageError(formatZodError(r.error));
    out.name = r.data;
  }
  if (input.description !== undefined) {
    const r = projectDescriptionSchema.safeParse(input.description);
    if (!r.success) throw new StorageError(formatZodError(r.error));
    out.description = r.data;
  }
  return out;
}

export class IndexedDbStorage implements VizoraStorage {
  private readonly dbPromise: Promise<IDBDatabase>;
  private readonly bus = new ChangeBus();

  constructor(factory?: IDBFactory, name?: string) {
    this.dbPromise = openDatabase(factory ?? globalThis.indexedDB, name);
    // Avoid an unhandled rejection; callers observe the error on first use.
    this.dbPromise.catch(() => undefined);
  }

  subscribe(listener: ChangeListener): () => void {
    return this.bus.subscribe(listener);
  }

  close(): void {
    this.bus.close();
    void this.dbPromise.then((db) => db.close()).catch(() => undefined);
  }

  private async tx<T>(
    stores: string | string[],
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction) => Promise<T>,
  ): Promise<T> {
    const db = await this.dbPromise;
    return withTransaction(db, stores, mode, work);
  }

  // ─── Projects ──────────────────────────────────────────────────────────────
  projects: VizoraStorage["projects"] = {
    list: async () => {
      const raw = await this.tx(STORES.projects, "readonly", (tx) =>
        requestToPromise(tx.objectStore(STORES.projects).getAll()),
      );
      const projects: Project[] = [];
      for (const item of raw) {
        try {
          projects.push(parseProject(item));
        } catch (error) {
          console.warn("Skipping unreadable project record", error);
        }
      }
      return projects.sort(byUpdatedDesc);
    },

    get: async (id) => {
      const raw = await this.tx(STORES.projects, "readonly", (tx) =>
        requestToPromise(tx.objectStore(STORES.projects).get(id)),
      );
      return raw === undefined ? undefined : parseProject(raw);
    },

    create: async (input) => {
      const valid = validateProjectInput(input);
      const now = nowIso();
      const project: Project = {
        id: createId(),
        schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
        name: valid.name ?? "",
        description: valid.description ?? "",
        createdAt: now,
        updatedAt: now,
      };
      await this.tx(STORES.projects, "readwrite", async (tx) => {
        await requestToPromise(tx.objectStore(STORES.projects).add(parseProject(project)));
      });
      this.bus.emit({ scope: "projects", id: project.id });
      return project;
    },

    update: async (id, patch) => {
      const valid = validateProjectInput(patch);
      const updated = await this.tx(STORES.projects, "readwrite", async (tx) => {
        const store = tx.objectStore(STORES.projects);
        const raw = await requestToPromise(store.get(id));
        if (raw === undefined) throw new NotFoundError("project", id);
        const next = parseProject({ ...parseProject(raw), ...valid, updatedAt: nowIso() });
        await requestToPromise(store.put(next));
        return next;
      });
      this.bus.emit({ scope: "projects", id });
      return updated;
    },

    duplicate: async (id) => {
      const result = await this.tx([STORES.projects, STORES.visualisations], "readwrite", async (tx) => {
        const projects = tx.objectStore(STORES.projects);
        const viz = tx.objectStore(STORES.visualisations);
        const raw = await requestToPromise(projects.get(id));
        if (raw === undefined) throw new NotFoundError("project", id);
        const source = parseProject(raw);
        const now = nowIso();
        const copy: Project = parseProject({ ...source, id: createId(), name: `${source.name.slice(0, 120 - 7)} (copy)`, createdAt: now, updatedAt: now });
        await requestToPromise(projects.add(copy));
        const items = (await requestToPromise(viz.index("byProject").getAll(id))).map((r) => ({ raw: r, rec: fromStored(r), order: orderOfStored(r) }));
        items.sort((a, b) => compareByCustomOrder({ order: a.order, createdAt: a.rec.document.createdAt }, { order: b.order, createdAt: b.rec.document.createdAt }));
        for (const [i, item] of items.entries()) {
          const doc = parseVisualisation({ ...structuredClone(item.rec.document), id: createId() });
          await requestToPromise(viz.add(toStored(copy.id, 1, doc, i)));
        }
        return { project: copy, visualisations: items.length };
      });
      this.bus.emit({ scope: "all", id: result.project.id });
      return result;
    },

    delete: async (id) => {
      const deletedVisualisations = await this.tx(
        [STORES.projects, STORES.visualisations],
        "readwrite",
        async (tx) => {
          const projects = tx.objectStore(STORES.projects);
          if ((await requestToPromise(projects.getKey(id))) === undefined) {
            throw new NotFoundError("project", id);
          }
          const viz = tx.objectStore(STORES.visualisations);
          const keys = await requestToPromise(viz.index("byProject").getAllKeys(id));
          for (const key of keys) await requestToPromise(viz.delete(key));
          await requestToPromise(projects.delete(id));
          return keys.length;
        },
      );
      this.bus.emit({ scope: "all", id });
      return { deletedVisualisations };
    },
  };

  // ─── Visualisations ────────────────────────────────────────────────────────
  visualisations: VizoraStorage["visualisations"] = {
    listByProject: async (projectId) => {
      const raw = await this.tx(STORES.visualisations, "readonly", (tx) =>
        requestToPromise(tx.objectStore(STORES.visualisations).index("byProject").getAll(projectId)),
      );
      return this.summaries(raw);
    },

    listAll: async () => {
      const raw = await this.tx(STORES.visualisations, "readonly", (tx) =>
        requestToPromise(tx.objectStore(STORES.visualisations).getAll()),
      );
      return this.summaries(raw);
    },

    get: async (id) => {
      const raw = await this.tx(STORES.visualisations, "readonly", (tx) =>
        requestToPromise(tx.objectStore(STORES.visualisations).get(id)),
      );
      return raw === undefined ? undefined : fromStored(raw);
    },

    create: async (projectId, document) => {
      const valid = parseVisualisation(document);
      const record = await this.tx([STORES.projects, STORES.visualisations], "readwrite", async (tx) => {
        if ((await requestToPromise(tx.objectStore(STORES.projects).getKey(projectId))) === undefined) {
          throw new NotFoundError("project", projectId);
        }
        const viz = tx.objectStore(STORES.visualisations);
        const siblings = (await requestToPromise(viz.index("byProject").getAll(projectId))).map((r) => ({ order: orderOfStored(r) }));
        await requestToPromise(viz.add(toStored(projectId, 1, valid, nextOrder(siblings))));
        await this.touchProject(tx, projectId);
        return { id: valid.id, projectId, revision: 1, document: valid } satisfies VisualisationRecord;
      });
      this.bus.emit({ scope: "visualisations", id: record.id });
      return record;
    },

    save: async (id, document, options) => {
      const record = await this.tx([STORES.projects, STORES.visualisations], "readwrite", async (tx) => {
        const store = tx.objectStore(STORES.visualisations);
        const raw = await requestToPromise(store.get(id));
        if (raw === undefined) throw new NotFoundError("visualisation", id);
        const current = fromStored(raw);
        if (!options.overwrite && current.revision !== options.expectedRevision) {
          throw new ConflictError(current);
        }
        if (document.id !== id) throw new StorageError("Visualisation id cannot be changed.");
        const valid = parseVisualisation({
          ...document,
          createdAt: current.document.createdAt,
          updatedAt: nowIso(),
        });
        const revision = current.revision + 1;
        await requestToPromise(store.put(toStored(current.projectId, revision, valid, orderOfStored(raw))));
        await this.touchProject(tx, current.projectId);
        return { id, projectId: current.projectId, revision, document: valid } satisfies VisualisationRecord;
      });
      this.bus.emit({ scope: "visualisations", id });
      return record;
    },

    duplicate: async (id) => {
      const record = await this.tx([STORES.projects, STORES.visualisations], "readwrite", async (tx) => {
        const store = tx.objectStore(STORES.visualisations);
        const raw = await requestToPromise(store.get(id));
        if (raw === undefined) throw new NotFoundError("visualisation", id);
        const source = fromStored(raw);
        const now = nowIso();
        const copy: VisualisationIR = parseVisualisation({
          ...structuredClone(source.document),
          id: createId(),
          title: `${source.document.title.slice(0, MAX_TITLE - 7)} (copy)`,
          createdAt: now,
          updatedAt: now,
        });
        // The copy sits directly after the original; everything is renumbered so the order stays unambiguous.
        const siblings = await this.projectItems(store, source.projectId);
        const ordered = siblings.map((s) => s.id);
        ordered.splice(ordered.indexOf(id) + 1, 0, copy.id);
        await requestToPromise(store.add(toStored(source.projectId, 1, copy, ordered.indexOf(copy.id))));
        await this.renumber(store, source.projectId, ordered);
        await this.touchProject(tx, source.projectId);
        return { id: copy.id, projectId: source.projectId, revision: 1, document: copy } satisfies VisualisationRecord;
      });
      this.bus.emit({ scope: "visualisations", id: record.id });
      return record;
    },

    move: async (id, projectId) => {
      const record = await this.tx([STORES.projects, STORES.visualisations], "readwrite", async (tx) => {
        const store = tx.objectStore(STORES.visualisations);
        const raw = await requestToPromise(store.get(id));
        if (raw === undefined) throw new NotFoundError("visualisation", id);
        const current = fromStored(raw);
        if (current.projectId === projectId) return current;
        if ((await requestToPromise(tx.objectStore(STORES.projects).getKey(projectId))) === undefined) {
          throw new NotFoundError("project", projectId);
        }
        const target = (await requestToPromise(store.index("byProject").getAll(projectId))).map((r) => ({ order: orderOfStored(r) }));
        // Content and revision are deliberately unchanged: moving is not an edit, so an open editor is not put in conflict.
        await requestToPromise(store.put(toStored(projectId, current.revision, current.document, nextOrder(target))));
        await this.touchProject(tx, projectId);
        await this.touchProject(tx, current.projectId);
        return { ...current, projectId } satisfies VisualisationRecord;
      });
      this.bus.emit({ scope: "visualisations", id });
      return record;
    },

    reorder: async (projectId, ids) => {
      await this.tx(STORES.visualisations, "readwrite", async (tx) => {
        const store = tx.objectStore(STORES.visualisations);
        const current = (await this.projectItems(store, projectId)).map((s) => s.id);
        const same = ids.length === current.length && new Set(ids).size === ids.length && ids.every((i) => current.includes(i));
        if (!same) throw new StorageError("This project changed while you were reordering. Reload and try again.");
        await this.renumber(store, projectId, ids);
      });
      this.bus.emit({ scope: "visualisations" });
    },

    delete: async (id) => {
      await this.tx([STORES.projects, STORES.visualisations], "readwrite", async (tx) => {
        const store = tx.objectStore(STORES.visualisations);
        const raw = await requestToPromise(store.get(id));
        if (raw === undefined) throw new NotFoundError("visualisation", id);
        const { projectId } = fromStored(raw);
        await requestToPromise(store.delete(id));
        await this.touchProject(tx, projectId);
      });
      this.bus.emit({ scope: "visualisations", id });
    },
  };

  // ─── Backup ────────────────────────────────────────────────────────────────
  backup: VizoraStorage["backup"] = {
    export: async () => {
      const [projects, visualisations] = await this.tx(
        [STORES.projects, STORES.visualisations],
        "readonly",
        async (tx) =>
          Promise.all([
            requestToPromise(tx.objectStore(STORES.projects).getAll()),
            requestToPromise(tx.objectStore(STORES.visualisations).getAll()),
          ]),
      );
      return buildBackup(projects, visualisations);
    },

    exportProject: async (projectId) => {
      const [project, visualisations] = await this.tx([STORES.projects, STORES.visualisations], "readonly", async (tx) =>
        Promise.all([
          requestToPromise(tx.objectStore(STORES.projects).get(projectId)),
          requestToPromise(tx.objectStore(STORES.visualisations).index("byProject").getAll(projectId)),
        ]),
      );
      if (project === undefined) throw new NotFoundError("project", projectId);
      return buildBackup([project], visualisations);
    },

    preview: async (raw) => {
      const backup = readBackup(raw);
      return this.tx([STORES.projects, STORES.visualisations], "readonly", async (tx) => {
        const projectStore = tx.objectStore(STORES.projects);
        const vizStore = tx.objectStore(STORES.visualisations);
        const projectExists = new Map<string, boolean>();
        const conflicts: BackupPreview["conflicts"] = [];
        let existingViz = 0;
        for (const p of backup.projects) {
          const exists = (await requestToPromise(projectStore.getKey(p.id))) !== undefined;
          projectExists.set(p.id, exists);
          if (exists) conflicts.push({ kind: "project", id: p.id, name: p.name });
        }
        for (const v of backup.visualisations) {
          if ((await requestToPromise(vizStore.getKey(v.id))) !== undefined) {
            existingViz++;
            conflicts.push({ kind: "visualisation", id: v.id, name: v.document.title });
          }
        }
        const existingProjects = [...projectExists.values()].filter(Boolean).length;
        return {
          exportedAt: backup.exportedAt,
          projects: { total: backup.projects.length, existing: existingProjects, new: backup.projects.length - existingProjects },
          visualisations: { total: backup.visualisations.length, existing: existingViz, new: backup.visualisations.length - existingViz },
          contents: backup.projects.map((p) => ({ id: p.id, name: p.name, visualisations: backup.visualisations.filter((v) => v.projectId === p.id).length, exists: projectExists.get(p.id) === true })),
          conflicts: conflicts.slice(0, 50),
        };
      });
    },

    import: async (raw, policy) => {
      const backup = readBackup(raw);
      const report = await this.tx([STORES.projects, STORES.visualisations], "readwrite", async (tx) => {
        const projectStore = tx.objectStore(STORES.projects);
        const vizStore = tx.objectStore(STORES.visualisations);
        const projectIdMap = new Map<string, string>();
        const report = { projectsAdded: 0, projectsSkipped: 0, visualisationsAdded: 0, visualisationsSkipped: 0 };

        for (const project of backup.projects) {
          const exists = (await requestToPromise(projectStore.getKey(project.id))) !== undefined;
          if (!exists) {
            await requestToPromise(projectStore.add(project));
            report.projectsAdded++;
          } else if (policy === "keep-both") {
            const copy: Project = {
              ...project,
              id: createId(),
              name: `${project.name.slice(0, 120 - 11)} (imported)`,
              updatedAt: nowIso(),
            };
            projectIdMap.set(project.id, copy.id);
            await requestToPromise(projectStore.add(copy));
            report.projectsAdded++;
          } else {
            report.projectsSkipped++;
          }
        }

        for (const item of backup.visualisations) {
          const projectId = projectIdMap.get(item.projectId) ?? item.projectId;
          const exists = (await requestToPromise(vizStore.getKey(item.id))) !== undefined;
          if (!exists) {
            await requestToPromise(vizStore.add(toStored(projectId, 1, item.document, item.order)));
            report.visualisationsAdded++;
          } else if (policy === "keep-both") {
            const copy = parseVisualisation({ ...item.document, id: createId() });
            await requestToPromise(vizStore.add(toStored(projectId, 1, copy, item.order)));
            report.visualisationsAdded++;
          } else {
            report.visualisationsSkipped++;
          }
        }
        return report;
      });
      this.bus.emit({ scope: "all" });
      return report;
    },
  };

  // ─── Maintenance ───────────────────────────────────────────────────────────
  data: VizoraStorage["data"] = {
    stats: async () => {
      const [projects, visualisations] = await this.tx([STORES.projects, STORES.visualisations], "readonly", async (tx) =>
        Promise.all([requestToPromise(tx.objectStore(STORES.projects).getAll()), requestToPromise(tx.objectStore(STORES.visualisations).getAll())]),
      );
      const names = new Map<string, string>();
      let bytes = 0;
      for (const p of projects) {
        try {
          const parsed = parseProject(p);
          names.set(parsed.id, parsed.name);
        } catch {
          /* unreadable project: still counted below */
        }
        bytes += JSON.stringify(p).length;
      }
      const per = new Map<string, { id: string; name: string; visualisations: number; bytes: number }>();
      const largest: { id: string; title: string; bytes: number }[] = [];
      let datasets = 0;
      for (const v of visualisations) {
        const size = JSON.stringify(v).length;
        bytes += size;
        try {
          const rec = fromStored(v);
          datasets += rec.document.data.datasets.length;
          const row = per.get(rec.projectId) ?? { id: rec.projectId, name: names.get(rec.projectId) ?? "Unknown project", visualisations: 0, bytes: 0 };
          row.visualisations++;
          row.bytes += size;
          per.set(rec.projectId, row);
          largest.push({ id: rec.id, title: rec.document.title, bytes: size });
        } catch {
          /* counted in bytes, not in the breakdown */
        }
      }
      for (const p of projects) {
        try {
          const parsed = parseProject(p);
          if (!per.has(parsed.id)) per.set(parsed.id, { id: parsed.id, name: parsed.name, visualisations: 0, bytes: 0 });
        } catch {
          /* ignore */
        }
      }
      return {
        projects: projects.length,
        visualisations: visualisations.length,
        datasets,
        bytes,
        perProject: [...per.values()].sort((a, b) => b.bytes - a.bytes),
        largest: largest.sort((a, b) => b.bytes - a.bytes).slice(0, 5),
      };
    },

    clearAll: async () => {
      await this.tx([STORES.projects, STORES.visualisations], "readwrite", async (tx) => {
        await requestToPromise(tx.objectStore(STORES.visualisations).clear());
        await requestToPromise(tx.objectStore(STORES.projects).clear());
      });
      this.bus.emit({ scope: "all" });
    },
  };

  /** A project's visualisations in their custom order. */
  private async projectItems(store: IDBObjectStore, projectId: string): Promise<{ id: string }[]> {
    const raws = await requestToPromise(store.index("byProject").getAll(projectId));
    return raws
      .map((r) => ({ id: fromStored(r).id, order: orderOfStored(r), createdAt: fromStored(r).document.createdAt }))
      .sort(compareByCustomOrder)
      .map(({ id }) => ({ id }));
  }

  /** Write 0..n-1 as the order of `ids`, touching only records whose order changes. */
  private async renumber(store: IDBObjectStore, projectId: string, ids: readonly string[]): Promise<void> {
    for (const [i, id] of ids.entries()) {
      const raw = await requestToPromise(store.get(id));
      if (raw === undefined) continue;
      const rec = fromStored(raw);
      if (rec.projectId !== projectId || orderOfStored(raw) === i) continue;
      await requestToPromise(store.put(toStored(projectId, rec.revision, rec.document, i)));
    }
  }

  /** A project's "last modified" follows its contents. */
  private async touchProject(tx: IDBTransaction, projectId: string): Promise<void> {
    const store = tx.objectStore(STORES.projects);
    const raw = await requestToPromise(store.get(projectId));
    if (raw === undefined) return;
    const p = parseProject(raw);
    const now = nowIso();
    await requestToPromise(store.put({ ...p, updatedAt: now > p.updatedAt ? now : p.updatedAt }));
  }

  private summaries(raw: unknown[]): VisualisationSummary[] {
    const out: VisualisationSummary[] = [];
    for (const item of raw) {
      try {
        out.push(summaryFromStored(item));
      } catch (error) {
        console.warn("Skipping unreadable visualisation record", toStorageError(error));
      }
    }
    return out.sort(byUpdatedDesc);
  }
}
