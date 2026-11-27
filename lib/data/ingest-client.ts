import { createIngestCore, type FileBuildOptions, type IngestRequestBody, type IngestResponse, type ReadSummary } from "./ingest-core";
import { IngestError, type IngestPreview } from "./types";

export interface IngestClient {
  read(file: File): Promise<ReadSummary>;
  build(options: FileBuildOptions): Promise<IngestPreview>;
  /** True when work happens off the page in a Web Worker. */
  readonly worker: boolean;
  dispose(): void;
}

/** Yield so the browser can paint ("Reading…") before synchronous work starts. */
const frame = () => new Promise<void>((r) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));

function inThread(): IngestClient {
  const core = createIngestCore();
  return {
    worker: false,
    async read(file) {
      await frame();
      return core.read(file);
    },
    async build(options) {
      await frame();
      return core.build(options);
    },
    dispose() {},
  };
}

function toError(r: Extract<IngestResponse, { ok: false }>): Error {
  return r.ingest ? new IngestError(r.message) : new Error(r.message);
}

/** A client that uses a Web Worker when the browser has one, and falls back to the page otherwise. */
export function createIngestClient(): IngestClient {
  if (typeof Worker === "undefined") return inThread();
  let w: Worker;
  try {
    w = new Worker(new URL("./ingest.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return inThread();
  }
  let next = 1;
  const pending = new Map<number, { resolve: (v: ReadSummary | IngestPreview) => void; reject: (e: Error) => void }>();
  w.onmessage = (ev: MessageEvent<IngestResponse>) => {
    const p = pending.get(ev.data.id);
    if (!p) return;
    pending.delete(ev.data.id);
    if (ev.data.ok) p.resolve(ev.data.result);
    else p.reject(toError(ev.data));
  };
  w.onerror = () => {
    const err = new Error("The file reader stopped unexpectedly. Try again, or use a smaller file.");
    pending.forEach((p) => p.reject(err));
    pending.clear();
  };
  const call = <T,>(msg: IngestRequestBody) => new Promise<T>((resolve, reject) => {
    const id = next++;
    pending.set(id, { resolve: resolve as (v: ReadSummary | IngestPreview) => void, reject });
    w.postMessage({ ...msg, id });
  });
  return {
    worker: true,
    read: (file) => call<ReadSummary>({ type: "read", file }),
    build: (options) => call<IngestPreview>({ type: "build", options }),
    dispose() {
      pending.forEach((p) => p.reject(new Error("Cancelled")));
      pending.clear();
      w.terminate();
    },
  };
}
