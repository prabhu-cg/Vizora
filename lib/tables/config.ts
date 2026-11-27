import { z } from "zod";
import { chartConfigSchema } from "@/lib/charts/config";
import type { VisualisationIR } from "@/types/visualisation";

export const TABLE_FORMATS = ["scale", "bars"] as const;
export type TableFormat = (typeof TABLE_FORMATS)[number];
export const FORMAT_LABEL: Record<TableFormat | "none", string> = { none: "None", scale: "Colour scale", bars: "Data bars" };

export const tableConfigSchema = z.object({
  datasetId: z.string().max(128).optional(),
  /** The columns shown, in order. Absent means every column, in the dataset's order. */
  columns: z.array(z.string().max(200)).max(500).optional(),
  sort: z.object({ key: z.string().max(200), dir: z.enum(["asc", "desc"]) }).optional(),
  /** Same filters as charts, so the same rows rules apply everywhere. */
  filters: chartConfigSchema.shape.filters,
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  pageSize: z.number().int().min(10).max(100).default(25),
  /** Numeric columns drawn with a colour scale or data bars. */
  formats: z.record(z.string().max(200), z.enum(TABLE_FORMATS)).default({}),
});
export type TableConfig = z.infer<typeof tableConfigSchema>;

export const defaultTableConfig = (): TableConfig => tableConfigSchema.parse({});

/** Read a table's settings from document options, tolerating missing or damaged values. */
export function readTableConfig(options: Record<string, unknown> | undefined): TableConfig {
  const r = tableConfigSchema.safeParse(options?.table);
  return r.success ? r.data : defaultTableConfig();
}

export const withTable = (doc: VisualisationIR, table: TableConfig): VisualisationIR => ({ ...doc, configuration: { options: { ...doc.configuration.options, table } } });
