import type { z } from "zod";
import type { projectSchema } from "@/lib/validation/project.schema";

export type Project = z.infer<typeof projectSchema>;

export interface ProjectInput {
  name: string;
  description?: string;
}

export interface ProjectWithStats extends Project {
  visualisationCount: number;
}
