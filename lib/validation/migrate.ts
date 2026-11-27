/**
 * Generic, versioned document migration.
 *
 * Every persisted document carries an integer `schemaVersion`. `steps[n]`
 * upgrades a version-n document to version n+1. Documents without a version
 * are treated as version 0 (pre-release shapes). Documents from a *newer*
 * schema than this build understands are rejected rather than downgraded, so
 * an older client can never silently corrupt newer data.
 */
export type RawDocument = Record<string, unknown>;
export type MigrationStep = (doc: RawDocument) => RawDocument;

export interface MigrationConfig {
  /** Human label used in error messages, e.g. "visualisation". */
  kind: string;
  current: number;
  steps: Readonly<Record<number, MigrationStep>>;
}

export class SchemaVersionError extends Error {
  override name = "SchemaVersionError";
  constructor(
    message: string,
    readonly found: unknown,
    readonly supported: number,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is RawDocument {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readSchemaVersion(raw: unknown): number | undefined {
  if (!isRecord(raw)) return undefined;
  const v = raw.schemaVersion;
  if (v === undefined) return 0;
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined;
}

export function migrateDocument(raw: unknown, config: MigrationConfig): RawDocument {
  if (!isRecord(raw)) {
    throw new SchemaVersionError(
      `Cannot read ${config.kind}: expected an object.`,
      raw,
      config.current,
    );
  }
  let version = readSchemaVersion(raw);
  if (version === undefined) {
    throw new SchemaVersionError(
      `Cannot read ${config.kind}: invalid schemaVersion.`,
      raw.schemaVersion,
      config.current,
    );
  }
  if (version > config.current) {
    throw new SchemaVersionError(
      `This ${config.kind} was created by a newer version of VIZORA (schema ${version}; this build supports up to ${config.current}). Update VIZORA to open it.`,
      version,
      config.current,
    );
  }
  let doc: RawDocument = { ...raw };
  while (version < config.current) {
    const step = config.steps[version];
    if (!step) {
      throw new SchemaVersionError(
        `No migration from ${config.kind} schema ${version}.`,
        version,
        config.current,
      );
    }
    doc = { ...step(doc), schemaVersion: version + 1 };
    version += 1;
  }
  return doc;
}
