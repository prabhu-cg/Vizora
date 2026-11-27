import type { BackupEnvelope, BackupPreview, ConflictPolicy, ImportReport } from "@/types/data";
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
    duplicate(id: string): Promise<VisualisationRecord>;
    delete(id: string): Promise<void>;
  };
  backup: {
    export(): Promise<BackupEnvelope>;
    /** Validates and summarises a backup without writing anything. */
    preview(raw: unknown): Promise<BackupPreview>;
    import(raw: unknown, policy: ConflictPolicy): Promise<ImportReport>;
  };
  subscribe(listener: ChangeListener): () => void;
  close(): void;
}
