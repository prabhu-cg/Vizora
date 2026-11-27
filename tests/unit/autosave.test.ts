import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutosaveController, type AutosaveState } from "@/features/visualisation/autosave";
import { ConflictError } from "@/lib/storage";
import type { VisualisationIR, VisualisationRecord } from "@/types/visualisation";
import { sampleDoc } from "../helpers";

function setup(save: (doc: VisualisationIR, o: { overwrite: boolean }) => Promise<VisualisationRecord>) {
  const states: AutosaveState[] = [];
  const controller = new AutosaveController({ save, onChange: (s) => states.push(s), delayMs: 500 });
  return { controller, states, last: () => states.at(-1)! };
}
const record = (doc: VisualisationIR, revision = 1): VisualisationRecord => ({ id: doc.id, projectId: "p", revision, document: doc });

describe("AutosaveController", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("marks unsaved immediately, then saves after the debounce window", async () => {
    const save = vi.fn(async (d: VisualisationIR) => record(d));
    const { controller, last } = setup(save);
    const doc = sampleDoc();
    controller.schedule(doc);
    expect(last().status).toBe("unsaved");
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(499);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(last().status).toBe("saved");
    expect(last().lastSavedAt).toBe(doc.updatedAt);
  });

  it("coalesces rapid edits into one save of the latest document", async () => {
    const save = vi.fn(async (d: VisualisationIR) => record(d));
    const { controller } = setup(save);
    const base = sampleDoc();
    controller.schedule({ ...base, title: "a" });
    await vi.advanceTimersByTimeAsync(300);
    controller.schedule({ ...base, title: "ab" });
    await vi.advanceTimersByTimeAsync(300);
    controller.schedule({ ...base, title: "abc" });
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0].title).toBe("abc");
  });

  it("serialises saves: an edit during a save is saved afterwards, never concurrently", async () => {
    let release!: () => void;
    let active = 0;
    let maxActive = 0;
    const titles: string[] = [];
    const save = vi.fn(async (d: VisualisationIR) => {
      active++;
      maxActive = Math.max(maxActive, active);
      titles.push(d.title);
      if (titles.length === 1) await new Promise<void>((r) => (release = r));
      active--;
      return record(d);
    });
    const { controller, last } = setup(save);
    const base = sampleDoc();
    controller.schedule({ ...base, title: "one" });
    await vi.advanceTimersByTimeAsync(500);
    expect(last().status).toBe("saving");
    controller.schedule({ ...base, title: "two" });
    expect(last().status).toBe("saving");
    release();
    await vi.advanceTimersByTimeAsync(600);
    expect(titles).toEqual(["one", "two"]);
    expect(maxActive).toBe(1);
    expect(last().status).toBe("saved");
  });

  it("keeps the edit on failure, does not spin, and retries on request", async () => {
    let fail = true;
    const save = vi.fn(async (d: VisualisationIR) => {
      if (fail) throw new Error("disk full");
      return record(d);
    });
    const { controller, last } = setup(save);
    controller.schedule(sampleDoc());
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(last()).toMatchObject({ status: "error", error: "disk full" });
    expect(controller.hasUnsavedChanges).toBe(true);

    fail = false;
    await controller.retry();
    expect(save).toHaveBeenCalledTimes(2);
    expect(last().status).toBe("saved");
  });

  it("halts on conflict and only overwrites after an explicit keep-mine decision", async () => {
    const mine = sampleDoc("mine");
    const theirs = record(sampleDoc("theirs"), 5);
    const save = vi.fn(async (d: VisualisationIR, o: { overwrite: boolean }) => {
      if (!o.overwrite) throw new ConflictError(theirs);
      return record(d, 6);
    });
    const { controller, last } = setup(save);
    controller.schedule(mine);
    await vi.advanceTimersByTimeAsync(500);
    expect(last().status).toBe("conflict");
    expect(last().conflict).toBe(theirs);

    controller.schedule({ ...mine, title: "mine 2" }); // edits while halted are retained, not sent
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);

    await controller.resolveKeepMine();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]![1]).toEqual({ overwrite: true });
    expect(save.mock.calls[1]![0].title).toBe("mine 2");
    expect(last().status).toBe("saved");
  });

  it("discarding local edits after a conflict resumes cleanly", async () => {
    const save = vi.fn(async () => {
      throw new ConflictError(record(sampleDoc("theirs"), 2));
    });
    const { controller, last } = setup(save);
    controller.schedule(sampleDoc());
    await vi.advanceTimersByTimeAsync(500);
    controller.resolveDiscardMine();
    expect(last().status).toBe("saved");
    expect(controller.hasUnsavedChanges).toBe(false);
  });

  it("flush saves immediately and dispose cancels timers", async () => {
    const save = vi.fn(async (d: VisualisationIR) => record(d));
    const { controller } = setup(save);
    controller.schedule(sampleDoc());
    await controller.flush();
    expect(save).toHaveBeenCalledTimes(1);
    controller.schedule(sampleDoc());
    controller.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
