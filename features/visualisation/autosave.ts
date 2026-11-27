import { ConflictError } from "@/lib/storage/errors";
import type { VisualisationIR, VisualisationRecord } from "@/types/visualisation";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error" | "conflict";

export interface AutosaveState {
  status: SaveStatus;
  /** ISO time of the last successful save. */
  lastSavedAt?: string;
  error?: string;
  /** The stored copy that won when status is "conflict". */
  conflict?: VisualisationRecord;
}

export interface AutosaveOptions {
  save: (doc: VisualisationIR, options: { overwrite: boolean }) => Promise<VisualisationRecord>;
  onChange: (state: AutosaveState) => void;
  onSaved?: (record: VisualisationRecord) => void;
  delayMs?: number;
  initialSavedAt?: string;
}

/**
 * Debounced, serialised autosave. Framework-free so it is unit-testable.
 *
 *  - Edits mark the document "unsaved" immediately and save after a quiet period.
 *  - Exactly one save is in flight; edits made meanwhile are saved right after.
 *  - A failed save keeps the document dirty (status "error") and is never dropped;
 *    it is retried by the next edit or an explicit retry(), not in a tight loop.
 *  - A revision conflict halts saving until the user explicitly resolves it, so
 *    nothing is ever silently overwritten.
 */
export class AutosaveController {
  private pending: VisualisationIR | undefined;
  private lastFailed: VisualisationIR | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private draining: Promise<void> | undefined;
  private halted = false;
  private overwriteNext = false;
  private disposed = false;
  private state: AutosaveState;
  private readonly delay: number;

  constructor(private readonly options: AutosaveOptions) {
    this.delay = options.delayMs ?? 800;
    this.state = { status: "saved", lastSavedAt: options.initialSavedAt };
  }

  get snapshot(): AutosaveState {
    return this.state;
  }

  get hasUnsavedChanges(): boolean {
    return this.pending !== undefined || this.draining !== undefined;
  }

  schedule(doc: VisualisationIR): void {
    if (this.disposed) return;
    this.pending = doc;
    if (this.halted) return; // retain the latest edit while awaiting conflict resolution
    this.set({ ...this.state, status: this.draining ? "saving" : "unsaved", error: undefined });
    this.clearTimer();
    this.timer = setTimeout(() => void this.flush(), this.delay);
  }

  /** Save now. Resolves when everything pending has been attempted. */
  flush(): Promise<void> {
    this.clearTimer();
    this.draining ??= this.drain().finally(() => {
      this.draining = undefined;
    });
    return this.draining;
  }

  retry(): Promise<void> {
    this.lastFailed = undefined;
    return this.flush();
  }

  /** The user chose to keep their version: save it over the conflicting stored copy. */
  resolveKeepMine(): Promise<void> {
    this.halted = false;
    this.overwriteNext = true;
    this.lastFailed = undefined;
    this.set({ status: "unsaved", lastSavedAt: this.state.lastSavedAt });
    return this.flush();
  }

  /** The user chose the stored copy: drop local edits and resume. */
  resolveDiscardMine(): void {
    this.pending = undefined;
    this.lastFailed = undefined;
    this.halted = false;
    this.clearTimer();
    this.set({ status: "saved", lastSavedAt: this.state.lastSavedAt });
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
  }

  private async drain(): Promise<void> {
    while (this.pending && !this.halted && this.pending !== this.lastFailed && !this.disposed) {
      const doc = this.pending;
      this.pending = undefined;
      this.set({ ...this.state, status: "saving", error: undefined });
      await this.attempt(doc);
    }
  }

  private async attempt(doc: VisualisationIR): Promise<void> {
    const overwrite = this.overwriteNext;
    this.overwriteNext = false;
    try {
      const record = await this.options.save(doc, { overwrite });
      this.lastFailed = undefined;
      this.options.onSaved?.(record);
      this.set({ status: this.pending ? "unsaved" : "saved", lastSavedAt: record.document.updatedAt });
    } catch (error) {
      this.pending ??= doc; // keep the edit unless a newer one superseded it
      if (error instanceof ConflictError) {
        this.halted = true;
        this.set({ ...this.state, status: "conflict", conflict: error.current, error: error.message });
      } else {
        this.lastFailed = doc;
        this.set({
          ...this.state,
          status: "error",
          error: error instanceof Error ? error.message : "Saving failed.",
        });
      }
    }
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private set(next: AutosaveState): void {
    this.state = next;
    if (!this.disposed) this.options.onChange(next);
  }
}
