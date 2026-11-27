import type { BackupEnvelope, BackupPreview, ConflictPolicy, ImportReport, StorageStats } from "@/types/data";
import type { Project, ProjectInput } from "@/types/project";
import type {
  VisualisationIR,
  VisualisationRecord,
  VisualisationSummary,
} from "@/types/visualisation";
import type { ChangeListener } from "./change-bus";

/**
 * Persistence contract. The app depends only on this interface, never on
 * IndexedDB, so a different backend (e.g. cloud sync in a later edition) can
 * be introduced without touching features.
 */
export interface VizoraStorage {
  projects: {
    list(): Promise<Project[]>;
    get(id: string): Promise<Project | undefined>;
    create(input: ProjectInput): Promise<Project>;
    update(id: string, patch: Partial<ProjectInput>): Promise<Project>;
    /** Copies a project and all of its visualisations (new ids, same order) in one atomic step. */
    duplicate(id: string): Promise<{ project: Project; visualisations: number }>;
    /** Deletes the project and all of its visualisations atomically. Callers must confirm with the user first. */
    delete(id: string): Promise<{ deletedVisualisations: number }>;
  };
  visualisations: {
    listByProject(projectId: string): Promise<VisualisationSummary[]>;
    listAll(): Promise<VisualisationSummary[]>;
    get(id: string): Promise<VisualisationRecord | undefined>;
    create(projectId: string, document: VisualisationIR): Promise<VisualisationRecord>;
    /**
     * Optimistic-concurrency save. Throws ConflictError if the stored revision
     * differs from `expectedRevision`, unless `overwrite` is explicitly set by
     * a user decision.
     */
    save(
      id: string,
      document: VisualisationIR,
      options: { expectedRevision: number; overwrite?: boolean },
    ): Promise<VisualisationRecord>;
    /** Copies a visualisation into the same project, directly after the original. */
    duplicate(id: string): Promise<VisualisationRecord>;
    /** Moves a visualisation to the end of another project. Its content and revision are untouched. */
    move(id: string, projectId: string): Promise<VisualisationRecord>;
    /**
     * Sets the order of every visualisation in a project. `ids` must be exactly the
     * project's current visualisations; if the list changed meanwhile this fails
     * instead of guessing, so nothing is silently dropped or reordered wrongly.
     */
    reorder(projectId: string, ids: string[]): Promise<void>;
    delete(id: string): Promise<void>;
  };
  backup: {
    export(): Promise<BackupEnvelope>;
    /** A backup containing just one project and its visualisations, in the same importable format. */
    exportProject(projectId: string): Promise<BackupEnvelope>;
    /** Validates and summarises a backup without writing anything. */
    preview(raw: unknown): Promise<BackupPreview>;
    import(raw: unknown, policy: ConflictPolicy): Promise<ImportReport>;
  };
  data: {
    stats(): Promise<StorageStats>;
    /** Deletes every project and visualisation. Callers must get explicit confirmation first. */
    clearAll(): Promise<void>;
  };
  subscribe(listener: ChangeListener): () => void;
  close(): void;
}
