/**
 * Undo/redo over whole-document snapshots. Snapshots are immutable IR values
 * that structurally share unchanged parts, so keeping many is cheap.
 * Rapid edits with the same `key` (typing in a field) collapse to one step.
 */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  private lastKey: string | undefined;
  private lastAt = 0;

  constructor(
    private readonly limit = 100,
    private readonly coalesceMs = 1000,
  ) {}

  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Record the state *before* an edit. */
  record(before: T, key?: string, now: number = Date.now()): void {
    const coalesce = key !== undefined && key === this.lastKey && now - this.lastAt < this.coalesceMs && this.past.length > 0;
    this.lastKey = key;
    this.lastAt = now;
    this.future = [];
    if (coalesce) return;
    this.past.push(before);
    if (this.past.length > this.limit) this.past.shift();
  }

  undo(current: T): T | undefined {
    const prev = this.past.pop();
    if (prev === undefined) return undefined;
    this.future.push(current);
    this.lastKey = undefined;
    return prev;
  }

  redo(current: T): T | undefined {
    const next = this.future.pop();
    if (next === undefined) return undefined;
    this.past.push(current);
    this.lastKey = undefined;
    return next;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.lastKey = undefined;
  }
}
