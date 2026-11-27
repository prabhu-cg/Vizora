import { z } from "zod";

/** Bump together with a new entry in lib/visualisation/migrations.ts. */
export const CURRENT_VISUALISATION_SCHEMA_VERSION = 1;

const isoDate = z.iso.datetime();
const id = z.string().min(1).max(128);
const finite = z.number().finite();
export const jsonRecordSchema = z.record(z.string(), z.json());

export const VISUALISATION_TYPES = [
  "diagram",
  "chart",
  "table",
  "timeline",
  "mindmap",
] as const;
export const visualisationTypeSchema = z.enum(VISUALISATION_TYPES);

export const sourceSchema = z.strictObject({
  kind: z.enum(["manual", "text", "csv", "json", "file"]),
  name: z.string().max(260).optional(),
  mimeType: z.string().max(120).optional(),
  size: z.number().int().nonnegative().optional(),
  importedAt: isoDate.optional(),
});

export const nodeSchema = z.strictObject({
  id,
  type: z.string().min(1).max(64),
  label: z.string().max(500),
  position: z.strictObject({ x: finite, y: finite }),
  size: z.strictObject({ width: finite.positive(), height: finite.positive() }).optional(),
  data: jsonRecordSchema,
  style: jsonRecordSchema.optional(),
});

export const edgeSchema = z.strictObject({
  id,
  source: id,
  target: id,
  label: z.string().max(500).optional(),
  type: z.string().max(64).optional(),
  data: jsonRecordSchema.optional(),
});

export const cellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const columnSchema = z.strictObject({
  key: z.string().min(1).max(200),
  label: z.string().max(200),
  type: z.enum(["string", "number", "boolean", "date", "unknown"]),
});

export const datasetSchema = z.strictObject({
  id,
  name: z.string().min(1).max(200),
  columns: z.array(columnSchema).max(500),
  rows: z.array(z.record(z.string(), cellSchema)).max(200_000),
});

export const layoutSchema = z.strictObject({
  algorithm: z.enum(["manual", "layered", "tree", "force", "grid"]),
  direction: z.enum(["TB", "BT", "LR", "RL"]),
  spacing: z.strictObject({ x: finite.nonnegative(), y: finite.nonnegative() }),
});

export const viewportSchema = z.strictObject({
  x: finite,
  y: finite,
  zoom: finite.min(0.05).max(8),
});

export const visualisationSchema = z
  .strictObject({
    id,
    schemaVersion: z.literal(CURRENT_VISUALISATION_SCHEMA_VERSION),
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().max(2000),
    type: visualisationTypeSchema,
    source: sourceSchema,
    nodes: z.array(nodeSchema).max(50_000),
    edges: z.array(edgeSchema).max(100_000),
    data: z.strictObject({ datasets: z.array(datasetSchema).max(100) }),
    configuration: z.strictObject({ options: jsonRecordSchema }),
    layout: layoutSchema,
    viewport: viewportSchema,
    createdAt: isoDate,
    updatedAt: isoDate,
  })
  .superRefine((doc, ctx) => {
    const nodeIds = new Set<string>();
    doc.nodes.forEach((node, i) => {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({ code: "custom", path: ["nodes", i, "id"], message: `Duplicate node id "${node.id}"` });
      }
      nodeIds.add(node.id);
    });
    const edgeIds = new Set<string>();
    doc.edges.forEach((edge, i) => {
      if (edgeIds.has(edge.id)) {
        ctx.addIssue({ code: "custom", path: ["edges", i, "id"], message: `Duplicate edge id "${edge.id}"` });
      }
      edgeIds.add(edge.id);
      for (const end of ["source", "target"] as const) {
        if (!nodeIds.has(edge[end])) {
          ctx.addIssue({
            code: "custom",
            path: ["edges", i, end],
            message: `Edge references missing node "${edge[end]}"`,
          });
        }
      }
    });
  });
