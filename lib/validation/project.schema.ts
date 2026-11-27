import { z } from "zod";

export const CURRENT_PROJECT_SCHEMA_VERSION = 1;

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(120, "Name must be 120 characters or fewer");

export const projectDescriptionSchema = z
  .string()
  .trim()
  .max(1000, "Description must be 1000 characters or fewer");

export const projectSchema = z.strictObject({
  id: z.string().min(1).max(128),
  schemaVersion: z.literal(CURRENT_PROJECT_SCHEMA_VERSION),
  name: projectNameSchema,
  description: z.string().max(1000),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
