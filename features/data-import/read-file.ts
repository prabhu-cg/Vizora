import { ingest, MAX_INGEST_BYTES, IngestError } from "@/lib/parsers";
import type { IngestResult } from "@/types/data";

/** Read a user-chosen File and ingest it. Rejects oversize files before reading. */
export async function ingestFile(file: File): Promise<IngestResult> {
  if (file.size > MAX_INGEST_BYTES) {
    throw new IngestError(`This file is too large (${(file.size / 1048576).toFixed(1)} MB). The limit is ${MAX_INGEST_BYTES / 1048576} MB.`);
  }
  const text = await file.text();
  return ingest({ text, name: file.name, mimeType: file.type, size: file.size });
}
