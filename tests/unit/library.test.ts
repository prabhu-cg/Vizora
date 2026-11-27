import { describe, expect, it } from "vitest";
import { isRecentlyModified, recency } from "@/lib/library/recency";
import { normalise, searchProjects, searchVisualisations, tokens } from "@/lib/library/search";
import { PROJECT_SORTS, VISUALISATION_SORTS, moveId, moveIdTo, sortProjects, sortVisualisations, type ProjectSort } from "@/lib/library/sort";
import type { ProjectWithStats } from "@/types/project";
import type { VisualisationSummary } from "@/types/visualisation";

const project = (id: string, name: string, updatedAt: string, createdAt = "2026-01-01T00:00:00.000Z", n = 0, description = ""): ProjectWithStats => ({
  id, schemaVersion: 1, name, description, createdAt, updatedAt, visualisationCount: n,
});
const viz = (id: string, title: string, o: Partial<VisualisationSummary> = {}): VisualisationSummary => ({
  id, projectId: "p1", revision: 1, title, description: "", type: "flowchart", nodeCount: 0, datasetCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ...o,
});

const PROJECTS = [
  project("a", "Café redesign", "2026-03-01T00:00:00.000Z", "2026-01-05T00:00:00.000Z", 2, "Menu and signage"),
  project("b", "annual report", "2026-05-01T00:00:00.000Z", "2026-01-03T00:00:00.000Z", 9),
  project("c", "Budget 2026", "2026-02-01T00:00:00.000Z", "2026-01-09T00:00:00.000Z", 5, "Finance planning"),
  project("d", "Zebra study", "2026-04-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z", 0),
];

describe("search", () => {
  it("ignores case, accents and extra spaces", () => {
    expect(normalise("  Café   MENU ")).toBe("cafe menu");
    expect(tokens("Cafe  redesign")).toEqual(["cafe", "redesign"]);
    expect(searchProjects(PROJECTS, "CAFE").map((r) => r.item.id)).toEqual(["a"]);
    expect(searchProjects(PROJECTS, "café").map((r) => r.item.id)).toEqual(["a"]);
  });
  it("an empty query returns everything untouched and in the given order", () => {
    expect(searchProjects(PROJECTS, "  ").map((r) => r.item.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("every word must match (AND), in the name or the description", () => {
    expect(searchProjects(PROJECTS, "menu signage").map((r) => r.item.id)).toEqual(["a"]);
    expect(searchProjects(PROJECTS, "menu zebra")).toEqual([]);
    expect(searchProjects(PROJECTS, "planning budget").map((r) => r.item.id)).toEqual(["c"]);
  });
  it("matches inside words and ranks a name match above a description match", () => {
    const list = [project("x", "Notes", "2026-01-01T00:00:00.000Z", undefined, 0, "about finance"), project("y", "Finance hub", "2026-01-01T00:00:00.000Z")];
    expect(searchProjects(list, "fin").map((r) => r.item.id)).toEqual(["y", "x"]);
    expect(searchProjects(list, "nanc").map((r) => r.item.id)).toEqual(expect.arrayContaining(["x", "y"]));
  });
  it("an exact title beats a partial one, and a word start beats a mid-word hit", () => {
    const items = [viz("1", "Launch plan overview"), viz("2", "Plan"), viz("3", "Airplane notes")];
    expect(searchVisualisations(items, () => "", "plan").map((r) => r.item.id)).toEqual(["2", "1", "3"]);
  });
  it("finds saved visualisations by title, description, project name and kind", () => {
    const items = [
      viz("1", "Onboarding", { type: "flowchart", description: "customer sign-up steps" }),
      viz("2", "Revenue", { type: "chart", projectId: "p2" }),
      viz("3", "Launch ideas", { type: "mindmap" }),
    ];
    const name = (id: string) => (id === "p2" ? "Quarterly board" : "Product");
    const ids = (q: string) => searchVisualisations(items, name, q).map((r) => r.item.id);
    expect(ids("onboard")).toEqual(["1"]);
    expect(ids("sign-up")).toEqual(["1"]);
    expect(ids("quarterly")).toEqual(["2"]);
    expect(ids("mind map")).toEqual(["3"]);
    expect(ids("flow chart")).toEqual(["1"]);
    expect(ids("nothing here")).toEqual([]);
  });
});

describe("sorting projects", () => {
  const ids = (by: ProjectSort) => sortProjects(PROJECTS, by).map((p) => p.id);
  it("offers each documented order", () => {
    expect(Object.keys(PROJECT_SORTS)).toEqual(["modified", "modified-asc", "name", "name-desc", "created", "size"]);
    expect(ids("modified")).toEqual(["b", "d", "a", "c"]);
    expect(ids("modified-asc")).toEqual(["c", "a", "d", "b"]);
    expect(ids("name")).toEqual(["b", "c", "a", "d"]); // annual, Budget, Café, Zebra: case-insensitive
    expect(ids("name-desc")).toEqual(["d", "a", "c", "b"]);
    expect(ids("created")).toEqual(["c", "a", "b", "d"]);
    expect(ids("size")).toEqual(["b", "c", "a", "d"]);
  });
  it("does not mutate its input and is stable on ties", () => {
    const tied = [project("2", "Same", "2026-01-01T00:00:00.000Z"), project("1", "Same", "2026-01-01T00:00:00.000Z")];
    const snapshot = JSON.stringify(PROJECTS);
    sortProjects(PROJECTS, "name");
    expect(JSON.stringify(PROJECTS)).toBe(snapshot);
    expect(sortProjects(tied, "modified").map((p) => p.id)).toEqual(["1", "2"]);
  });
  it("sorts numbers inside names naturally", () => {
    const list = [project("1", "Plan 10", "2026-01-01T00:00:00.000Z"), project("2", "Plan 2", "2026-01-01T00:00:00.000Z")];
    expect(sortProjects(list, "name").map((p) => p.name)).toEqual(["Plan 2", "Plan 10"]);
  });
});

describe("sorting visualisations", () => {
  const items = [
    viz("c", "Charlie", { order: 2, type: "timeline", updatedAt: "2026-03-01T00:00:00.000Z", createdAt: "2026-01-03T00:00:00.000Z" }),
    viz("a", "alpha", { order: 0, type: "chart", updatedAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" }),
    viz("b", "Bravo", { order: 1, type: "flowchart", updatedAt: "2026-02-01T00:00:00.000Z", createdAt: "2026-01-02T00:00:00.000Z" }),
  ];
  it("supports custom order, recency, name, type and creation", () => {
    expect(Object.keys(VISUALISATION_SORTS)).toEqual(["custom", "modified", "name", "type", "created"]);
    const ids = (k: keyof typeof VISUALISATION_SORTS) => sortVisualisations(items, k).map((v) => v.id);
    expect(ids("custom")).toEqual(["a", "b", "c"]);
    expect(ids("modified")).toEqual(["c", "b", "a"]);
    expect(ids("name")).toEqual(["a", "b", "c"]);
    expect(ids("type")).toEqual(["a", "b", "c"]); // chart, flowchart, timeline
    expect(ids("created")).toEqual(["c", "b", "a"]);
  });
  it("custom order puts items without one first, oldest first", () => {
    const mixed = [viz("new", "New", { order: 0 }), viz("old", "Old", { createdAt: "2025-01-01T00:00:00.000Z" })];
    expect(sortVisualisations(mixed, "custom").map((v) => v.id)).toEqual(["old", "new"]);
  });
});

describe("reordering ids", () => {
  it("moves up and down, and stops at the ends", () => {
    expect(moveId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveId(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b"], "zzz", 1)).toEqual(["a", "b"]);
  });
  it("moves to an index", () => {
    expect(moveIdTo(["a", "b", "c", "d"], "d", 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveIdTo(["a", "b", "c", "d"], "a", 99)).toEqual(["b", "c", "d", "a"]);
    expect(moveIdTo(["a", "b"], "zzz", 0)).toEqual(["a", "b"]);
  });
});

describe("recency", () => {
  const now = Date.parse("2026-06-15T12:00:00.000Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  it("describes how recently something changed", () => {
    expect(recency(ago(60_000), now)).toEqual({ level: "just-now", label: "just now" });
    expect(recency(ago(30 * 60_000), now)).toEqual({ level: "today", label: "30 minutes ago" });
    expect(recency(ago(3 * 3_600_000), now)).toEqual({ level: "today", label: "3 hours ago" });
    expect(recency(ago(1 * 3_600_000), now).label).toBe("1 hour ago");
    expect(recency(ago(3 * 86_400_000), now)).toEqual({ level: "this-week", label: "3 days ago" });
    expect(recency(ago(30 * 86_400_000), now).level).toBe("older");
    expect(recency("nonsense", now)).toEqual({ level: "older", label: "unknown" });
  });
  it("'recently modified' means the last 24 hours", () => {
    expect(isRecentlyModified(ago(23 * 3_600_000), now)).toBe(true);
    expect(isRecentlyModified(ago(25 * 3_600_000), now)).toBe(false);
  });
  it("a future timestamp (clock skew) is treated as just now, not negative", () => {
    expect(recency(new Date(now + 5 * 60_000).toISOString(), now).level).toBe("just-now");
  });
});
