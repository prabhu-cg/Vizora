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
import type { Project, ProjectInput } from "@/types/project";
import type { VisualisationIR, VisualisationRecord, VisualisationSummary } from "@/types/visualisation";
import { readBackup, buildBackup } from "./backup";
import { ChangeBus, type ChangeListener } from "./change-bus";
import { openDatabase, requestToPromise, STORES, toStorageError, withTransaction } from "./database";
import { ConflictError, NotFoundError, StorageError } from "./errors";
import { fromStored, summaryFromStored, toStored } from "./records";
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
      const record = await this.tx(
        [STORES.projects, STORES.visualisations],
        "readwrite",
        async (tx) => {
          if ((await requestToPromise(tx.objectStore(STORES.projects).getKey(projectId))) === undefined) {
            throw new NotFoundError("project", projectId);
          }
          await requestToPromise(tx.objectStore(STORES.visualisations).add(toStored(projectId, 1, valid)));
          return { id: valid.id, projectId, revision: 1, document: valid } satisfies VisualisationRecord;
        },
      );
      this.bus.emit({ scope: "visualisations", id: record.id });
      return record;
    },

    save: async (id, document, options) => {
      const record = await this.tx(STORES.visualisations, "readwrite", async (tx) => {
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
        await requestToPromise(store.put(toStored(current.projectId, revision, valid)));
        return { id, projectId: current.projectId, revision, document: valid } satisfies VisualisationRecord;
      });
      this.bus.emit({ scope: "visualisations", id });
      return record;
    },

    duplicate: async (id) => {
      const record = await this.tx(STORES.visualisations, "readwrite", async (tx) => {
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
        await requestToPromise(store.add(toStored(source.projectId, 1, copy)));
        return { id: copy.id, projectId: source.projectId, revision: 1, document: copy } satisfies VisualisationRecord;
      });
      this.bus.emit({ scope: "visualisations", id: record.id });
      return record;
    },

    delete: async (id) => {
      await this.tx(STORES.visualisations, "readwrite", async (tx) => {
        const store = tx.objectStore(STORES.visualisations);
        if ((await requestToPromise(store.getKey(id))) === undefined) throw new NotFoundError("visualisation", id);
        await requestToPromise(store.delete(id));
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

    preview: async (raw) => {
      const backup = readBackup(raw);
      return this.tx([STORES.projects, STORES.visualisations], "readonly", async (tx) => {
        const projectStore = tx.objectStore(STORES.projects);
        const vizStore = tx.objectStore(STORES.visualisations);
        let existingProjects = 0;
        let existingViz = 0;
        for (const p of backup.projects) {
          if ((await requestToPromise(projectStore.getKey(p.id))) !== undefined) existingProjects++;
        }
        for (const v of backup.visualisations) {
          if ((await requestToPromise(vizStore.getKey(v.id))) !== undefined) existingViz++;
        }
        return {
          exportedAt: backup.exportedAt,
          projects: {
            total: backup.projects.length,
            existing: existingProjects,
            new: backup.projects.length - existingProjects,
          },
          visualisations: {
            total: backup.visualisations.length,
            existing: existingViz,
            new: backup.visualisations.length - existingViz,
          },
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
            await requestToPromise(vizStore.add(toStored(projectId, 1, item.document)));
            report.visualisationsAdded++;
          } else if (policy === "keep-both") {
            const copy = parseVisualisation({ ...item.document, id: createId() });
            await requestToPromise(vizStore.add(toStored(projectId, 1, copy)));
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
