import { z } from "zod";
import { parseVisualisation } from "@/lib/visualisation/migrations";
import { visualisationTypeSchema } from "@/lib/validation";
import type { VisualisationIR, VisualisationRecord, VisualisationSummary } from "@/types/visualisation";
import { StorageError } from "./errors";

/**
 * On-disk shape of a visualisation. `document` is the IR (validated and
 * migrated on read); `meta` is denormalised so lists never have to parse
 * large documents.
 */
const metaSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: visualisationTypeSchema,
  nodeCount: z.number().int().nonnegative(),
  datasetCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const storedSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  revision: z.number().int().min(1),
  meta: metaSchema,
  document: z.unknown(),
});

export type StoredVisualisation = z.infer<typeof storedSchema>;

export function toStored(
  projectId: string,
  revision: number,
  document: VisualisationIR,
): StoredVisualisation {
  return {
    id: document.id,
    projectId,
    revision,
    meta: {
      title: document.title,
      description: document.description,
      type: document.type,
      nodeCount: document.nodes.length,
      datasetCount: document.data.datasets.length,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    },
    document,
  };
}

function readStored(raw: unknown): StoredVisualisation {
  const result = storedSchema.safeParse(raw);
  if (!result.success) throw new StorageError("A stored visualisation is unreadable (corrupt record).");
  return result.data;
}

export function fromStored(raw: unknown): VisualisationRecord {
  const stored = readStored(raw);
  const document = parseVisualisation(stored.document);
  if (document.id !== stored.id) {
    throw new StorageError("A stored visualisation has a mismatched id (corrupt record).");
  }
  return { id: stored.id, projectId: stored.projectId, revision: stored.revision, document };
}

export function summaryFromStored(raw: unknown): VisualisationSummary {
  const s = readStored(raw);
  return { id: s.id, projectId: s.projectId, revision: s.revision, ...s.meta };
}
