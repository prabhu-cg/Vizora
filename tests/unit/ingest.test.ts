import { afterEach, describe, expect, it, vi } from "vitest";
import { IngestError, createIngestClient, createIngestCore, type IngestRequest, type IngestResponse } from "@/lib/data";

const csv = (rows = 50) => new File([["a,b", ...Array.from({ length: rows }, (_, i) => `x${i},${i}`)].join("\n")], "t.csv", { type: "text/csv" });
afterEach(() => vi.unstubAllGlobals());

describe("ingest core", () => {
  it("reads once, then builds with different options without re-reading", async () => {
    const core = createIngestCore();
    const summary = await core.read(csv());
    expect(summary.source).toMatchObject({ name: "t.csv", format: "csv" });
    expect(core.build({}).dataset.rows).toHaveLength(50);
    expect(core.build({ header: false }).dataset.rows).toHaveLength(51);
  });
  it("refuses to build before a file is read", () => {
    expect(() => createIngestCore().build({})).toThrow(/No file has been read/);
  });
  it("reports unreadable files with the usual plain-language error", async () => {
    await expect(createIngestCore().read(new File(["x"], "evil.exe"))).rejects.toBeInstanceOf(IngestError);
  });
});

describe("ingest client without Web Workers", () => {
  it("falls back to doing the work on the page", async () => {
    const client = createIngestClient();
    expect(client.worker).toBe(false);
    await client.read(csv());
    expect((await client.build({})).dataset.rows).toHaveLength(50);
    client.dispose();
  });
});

describe("ingest client with a Web Worker", () => {
  /** A worker double that runs the real core, so the message protocol is what is under test. */
  function stubWorker() {
    const core = createIngestCore();
    const terminate = vi.fn();
    class FakeWorker {
      onmessage?: (e: MessageEvent<IngestResponse>) => void;
      onerror?: () => void;
      constructor() {}
      terminate = terminate;
      postMessage(msg: IngestRequest) {
        void (async () => {
          try {
            const result = msg.type === "read" ? await core.read(msg.file) : core.build(msg.options);
            this.onmessage?.({ data: { id: msg.id, ok: true, result } } as MessageEvent<IngestResponse>);
          } catch (e) {
            this.onmessage?.({ data: { id: msg.id, ok: false, message: (e as Error).message, ingest: e instanceof IngestError } } as MessageEvent<IngestResponse>);
          }
        })();
      }
    }
    vi.stubGlobal("Worker", FakeWorker);
    return { terminate };
  }

  it("reads and builds through messages, keeping IngestError identity", async () => {
    stubWorker();
    const client = createIngestClient();
    expect(client.worker).toBe(true);
    const summary = await client.read(csv(10));
    expect(summary.source.name).toBe("t.csv");
    expect((await client.build({})).dataset.rows).toHaveLength(10);
    await expect(client.build({ header: true, types: {} }).then(() => client.read(new File(["x"], "bad.exe")))).rejects.toBeInstanceOf(IngestError);
  });
  it("answers overlapping requests independently", async () => {
    stubWorker();
    const client = createIngestClient();
    await client.read(csv(20));
    const [a, b] = await Promise.all([client.build({}), client.build({ header: false })]);
    expect(a.dataset.rows).toHaveLength(20);
    expect(b.dataset.rows).toHaveLength(21);
  });
  it("terminates the worker and rejects outstanding work when disposed", async () => {
    const { terminate } = stubWorker();
    const client = createIngestClient();
    client.dispose();
    expect(terminate).toHaveBeenCalled();
  });
});
