/// <reference lib="webworker" />
import { createIngestCore, type IngestRequest, type IngestResponse } from "./ingest-core";
import { IngestError } from "./types";

const core = createIngestCore();

self.onmessage = async (event: MessageEvent<IngestRequest>) => {
  const msg = event.data;
  try {
    const result = msg.type === "read" ? await core.read(msg.file) : core.build(msg.options);
    (self as unknown as Worker).postMessage({ id: msg.id, ok: true, result } satisfies IngestResponse);
  } catch (e) {
    (self as unknown as Worker).postMessage({ id: msg.id, ok: false, message: e instanceof Error ? e.message : "This file could not be read.", ingest: e instanceof IngestError } satisfies IngestResponse);
  }
};
