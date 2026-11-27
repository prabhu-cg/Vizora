import { formatZodError } from "./format-error";
import { migrateDocument, type MigrationStep } from "./migrate";
import { CURRENT_PROJECT_SCHEMA_VERSION, projectSchema } from "./project.schema";
import type { Project } from "@/types/project";

const steps: Record<number, MigrationStep> = {
  0: (doc) => {
    const now = new Date().toISOString();
    const updatedAt = typeof doc.updatedAt === "string" ? doc.updatedAt : now;
    return {
      ...doc,
      description: typeof doc.description === "string" ? doc.description : "",
      createdAt: typeof doc.createdAt === "string" ? doc.createdAt : updatedAt,
      updatedAt,
    };
  },
};

export function parseProject(raw: unknown): Project {
  const migrated = migrateDocument(raw, {
    kind: "project",
    current: CURRENT_PROJECT_SCHEMA_VERSION,
    steps,
  });
  const result = projectSchema.safeParse(migrated);
  if (!result.success) {
    throw new Error(`Invalid project: ${formatZodError(result.error)}`);
  }
  return result.data;
}
