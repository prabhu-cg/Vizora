import { z } from "zod";

export const BACKUP_FORMAT = "vizora-backup";
export const CURRENT_BACKUP_VERSION = 1;

/**
 * Envelope only. Projects and visualisation documents are intentionally typed
 * `unknown` here: each is migrated to the current schema and then validated
 * individually, so an older backup remains importable.
 */
export const backupEnvelopeSchema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  backupVersion: z.literal(CURRENT_BACKUP_VERSION),
  exportedAt: z.iso.datetime(),
  app: z.strictObject({ name: z.literal("VIZORA"), edition: z.string().max(32) }),
  projects: z.array(z.unknown()),
  visualisations: z.array(
    z.strictObject({
      id: z.string().min(1).max(128),
      projectId: z.string().min(1).max(128),
      document: z.unknown(),
    }),
  ),
});
