import type { z } from "zod";

/** Flatten a ZodError into one readable line per issue. */
export function formatZodError(error: z.ZodError, limit = 5): string {
  const lines = error.issues.slice(0, limit).map((issue) => {
    const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
  const extra = error.issues.length - lines.length;
  return extra > 0 ? `${lines.join("; ")}; and ${extra} more` : lines.join("; ");
}
