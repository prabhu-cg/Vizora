import { describe, expect, it } from "vitest";
import { SchemaVersionError, visualisationSchema, CURRENT_VISUALISATION_SCHEMA_VERSION } from "@/lib/validation";
import { createNode, createVisualisation } from "@/lib/visualisation/factory";
import { InvalidVisualisationError, parseVisualisation } from "@/lib/visualisation/migrations";

describe("Visualisation IR schema", () => {
  it("accepts a freshly created visualisation with every required IR field", () => {
    const doc = createVisualisation({ title: "T", type: "diagram" });
    expect(visualisationSchema.safeParse(doc).success).toBe(true);
    for (const key of [
      "id", "schemaVersion", "title", "description", "type", "source",
      "nodes", "edges", "data", "configuration", "layout", "viewport", "createdAt", "updatedAt",
    ]) {
      expect(doc).toHaveProperty(key);
    }
  });

  it("rejects duplicate node ids and dangling edges", () => {
    const doc = createVisualisation({ title: "T", type: "diagram" });
    const a = createNode({ id: "a", position: { x: 0, y: 0 } });
    expect(visualisationSchema.safeParse({ ...doc, nodes: [a, a] }).success).toBe(false);
    const dangling = { ...doc, nodes: [a], edges: [{ id: "e", source: "a", target: "zzz" }] };
    expect(visualisationSchema.safeParse(dangling).success).toBe(false);
  });

  it("rejects non-finite coordinates, empty titles, unknown keys and bad types", () => {
    const doc = createVisualisation({ title: "T", type: "diagram" });
    const bad = (patch: object) => visualisationSchema.safeParse({ ...doc, ...patch }).success;
    expect(bad({ nodes: [{ ...createNode({ position: { x: Infinity, y: 0 } }) }] })).toBe(false);
    expect(bad({ title: "   " })).toBe(false);
    expect(bad({ surprise: 1 })).toBe(false);
    expect(bad({ type: "hologram" })).toBe(false);
    expect(bad({ viewport: { x: 0, y: 0, zoom: 0 } })).toBe(false);
  });
});

describe("schema migrations", () => {
  it("upgrades an unversioned (v0) document to the current schema", () => {
    const legacy = { id: "old", title: "Legacy", nodes: [{ id: "n", type: "default", label: "L", position: { x: 1, y: 2 }, data: {} }] };
    const doc = parseVisualisation(legacy);
    expect(doc.schemaVersion).toBe(CURRENT_VISUALISATION_SCHEMA_VERSION);
    expect(doc.nodes).toHaveLength(1);
    expect(doc.description).toBe("");
    expect(doc.viewport.zoom).toBe(1);
    expect(doc.createdAt).toBeTruthy();
  });

  it("is idempotent for current documents", () => {
    const doc = createVisualisation({ title: "T", type: "chart" });
    expect(parseVisualisation(doc)).toEqual(doc);
  });

  it("refuses documents from a newer schema instead of downgrading them", () => {
    const doc = { ...createVisualisation({ title: "T", type: "diagram" }), schemaVersion: CURRENT_VISUALISATION_SCHEMA_VERSION + 1 };
    expect(() => parseVisualisation(doc)).toThrow(SchemaVersionError);
    expect(() => parseVisualisation(doc)).toThrow(/newer version/);
  });

  it("reports invalid content with a readable message", () => {
    const doc = { ...createVisualisation({ title: "T", type: "diagram" }), title: "" };
    expect(() => parseVisualisation(doc)).toThrow(InvalidVisualisationError);
  });

  it("rejects garbage input", () => {
    expect(() => parseVisualisation(null)).toThrow(SchemaVersionError);
    expect(() => parseVisualisation({ schemaVersion: "1" })).toThrow(SchemaVersionError);
    expect(() => parseVisualisation({ schemaVersion: -1 })).toThrow(SchemaVersionError);
  });
});
