import { describe, expect, it } from "vitest";
import {
  GRID_COLUMNS, MAX_WIDGETS, MIN_H, MIN_W, addWidget, arrange, cellAt, chartConfigSchema, dashboardSchema, dragPreview, duplicateWidget, emptyDashboard, moveWidget, readDashboard,
  readingOrder, removeWidget, resizeWidget, updateWidgetChart, type Dashboard, type Widget,
} from "@/lib/charts";

const chart = (title = "") => chartConfigSchema.parse({ title });
const boxes = (d: Dashboard) => d.widgets.map((w) => [w.x, w.y, w.w, w.h]);
const overlap = (d: Dashboard) => d.widgets.some((a, i) => d.widgets.some((b, j) => i < j && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));
const withinGrid = (d: Dashboard) => d.widgets.every((w) => w.x >= 0 && w.x + w.w <= GRID_COLUMNS && w.y >= 0 && w.w >= MIN_W && w.h >= MIN_H);
const build = (n: number, size = { w: 6, h: 4 }) => Array.from({ length: n }).reduce<Dashboard>((d) => addWidget(d, chart(), size).dashboard, emptyDashboard());

describe("adding", () => {
  it("fills the grid left to right, then starts a new row", () => {
    expect(boxes(build(3))).toEqual([[0, 0, 6, 4], [6, 0, 6, 4], [0, 4, 6, 4]]);
  });
  it("finds gaps instead of always appending", () => {
    let d = build(3);
    d = removeWidget(d, d.widgets[1]!.id); // frees the top-right slot; compaction closes ranks
    d = addWidget(d, chart("new"), { w: 6, h: 4 }).dashboard;
    expect(overlap(d)).toBe(false);
    expect(boxes(d).sort()).toEqual([[0, 0, 6, 4], [0, 4, 6, 4], [6, 0, 6, 4]].sort());
  });
  it("clamps sizes into the allowed range and refuses past the limit", () => {
    expect(boxes(addWidget(emptyDashboard(), chart(), { w: 99, h: 99 }).dashboard)[0]).toEqual([0, 0, GRID_COLUMNS, 12]);
    expect(boxes(addWidget(emptyDashboard(), chart(), { w: 1, h: 1 }).dashboard)[0]).toEqual([0, 0, MIN_W, MIN_H]);
    const full = build(MAX_WIDGETS, { w: 3, h: 2 });
    expect(full.widgets).toHaveLength(MAX_WIDGETS);
    expect(addWidget(full, chart()).id).toBe("");
  });
});

describe("moving and rearranging", () => {
  it("swapping places keeps everything on the grid with no overlap", () => {
    const d = build(2);
    const moved = moveWidget(d, d.widgets[1]!.id, 0, 0);
    expect(overlap(moved)).toBe(false);
    const a = moved.widgets.find((w) => w.id === d.widgets[1]!.id)!;
    expect([a.x, a.y]).toEqual([0, 0]);
    const b = moved.widgets.find((w) => w.id === d.widgets[0]!.id)!;
    expect(b.y).toBeGreaterThan(0); // pushed below, not overlapped
  });
  it("clamps to the grid edges and ignores no-op moves", () => {
    const d = build(1);
    expect(boxes(moveWidget(d, d.widgets[0]!.id, 99, -5))[0]).toEqual([6, 0, 6, 4]);
    expect(moveWidget(d, d.widgets[0]!.id, 0, 0)).toBe(d);
    expect(moveWidget(d, "nope", 1, 1)).toBe(d);
  });
  it("closes gaps (gravity)", () => {
    const d = build(2);
    const lonely = moveWidget(removeWidget(d, d.widgets[0]!.id), d.widgets[1]!.id, 0, 7);
    expect(boxes(lonely)).toEqual([[0, 0, 6, 4]]);
  });
});

describe("resizing", () => {
  it("grows without leaving the grid and pushes neighbours down", () => {
    const d = build(2);
    const r = resizeWidget(d, d.widgets[0]!.id, 12, 6);
    expect(overlap(r)).toBe(false);
    expect(withinGrid(r)).toBe(true);
    expect(r.widgets[0]).toMatchObject({ w: 12, h: 6 });
    expect(r.widgets[1]!.y).toBeGreaterThanOrEqual(6);
  });
  it("cannot extend past the right edge or shrink below the minimum", () => {
    const d = build(2);
    expect(resizeWidget(d, d.widgets[1]!.id, 12, 4).widgets[1]!.w).toBe(6);
    expect(resizeWidget(d, d.widgets[0]!.id, 1, 1).widgets[0]).toMatchObject({ w: MIN_W, h: MIN_H });
    expect(resizeWidget(d, d.widgets[0]!.id, 6, 4)).toBe(d);
  });
});

describe("deleting, editing, duplicating", () => {
  it("removes a widget and keeps the rest valid", () => {
    const d = build(4);
    const r = removeWidget(d, d.widgets[0]!.id);
    expect(r.widgets).toHaveLength(3);
    expect(overlap(r)).toBe(false);
    expect(removeWidget(r, "nope")).toBe(r);
  });
  it("updates one widget's chart only", () => {
    const d = build(2);
    const r = updateWidgetChart(d, d.widgets[1]!.id, (c) => ({ ...c, title: "Changed" }));
    expect(r.widgets.map((w) => w.chart.title)).toEqual(["", "Changed"]);
    expect(updateWidgetChart(d, d.widgets[0]!.id, (c) => c)).toBe(d);
  });
  it("duplicates into free space with an independent copy", () => {
    const d = addWidget(emptyDashboard(), chart("Revenue"), { w: 4, h: 3 }).dashboard;
    const { dashboard, id } = duplicateWidget(d, d.widgets[0]!.id);
    const copy = dashboard.widgets.find((w) => w.id === id)!;
    expect(copy.chart.title).toBe("Revenue (copy)");
    expect(overlap(dashboard)).toBe(false);
    copy.chart.filters.push({ column: "a", op: "eq", value: "x" });
    expect(dashboard.widgets[0]!.chart.filters).toEqual([]);
  });
});

describe("invariants under arbitrary edits", () => {
  it("never overlaps or leaves the grid, whatever the sequence of operations", () => {
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
    let d = build(5, { w: 4, h: 3 });
    for (let i = 0; i < 400; i++) {
      const w = d.widgets[rnd(d.widgets.length)];
      const op = rnd(5);
      if (op === 0 && w) d = moveWidget(d, w.id, rnd(14) - 1, rnd(20) - 2);
      else if (op === 1 && w) d = resizeWidget(d, w.id, rnd(14), rnd(14));
      else if (op === 2 && d.widgets.length < 10) d = addWidget(d, chart(), { w: 3 + rnd(6), h: 2 + rnd(4) }).dashboard;
      else if (op === 3 && w && d.widgets.length > 1) d = removeWidget(d, w.id);
      else if (op === 4 && w && d.widgets.length < 10) d = duplicateWidget(d, w.id).dashboard;
      expect(overlap(d), `after op ${i}`).toBe(false);
      expect(withinGrid(d), `after op ${i}`).toBe(true);
    }
  });
  it("arrange is stable: arranging an arranged layout changes nothing", () => {
    const d = build(6, { w: 4, h: 3 });
    expect(arrange(d.widgets)).toEqual(d.widgets);
  });
});

describe("small screens and pointer mapping", () => {
  it("reading order is top to bottom, then left to right", () => {
    const ws = [{ id: "c", x: 0, y: 4 }, { id: "b", x: 6, y: 0 }, { id: "a", x: 0, y: 0 }] as unknown as Widget[];
    expect(readingOrder(ws).map((w) => w.id)).toEqual(["a", "b", "c"]);
  });
  it("maps a pointer position to a grid cell", () => {
    expect(cellAt(0, 0, 1200)).toEqual({ col: 0, row: 0 });
    expect(cellAt(601, 90, 1200)).toEqual({ col: 6, row: 1 });
  });
});

describe("pointer drag maths", () => {
  const grid = { left: 100, top: 50, width: 1200 }; // 100px per column; rows are 84px
  const w = { x: 2, y: 1, w: 4, h: 3 };
  it("moves by whole cells, keeping the grab point under the pointer", () => {
    // grabbed 30px right and 20px down inside the widget; pointer moves 2 columns right, 1 row down
    const p = dragPreview("move", { x: 100 + 2 * 100 + 30 + 200, y: 50 + 84 + 20 + 84 }, grid, { dx: 30, dy: 20 }, w);
    expect(p).toMatchObject({ x: 4, y: 2, w: 4, h: 3 });
  });
  it("cannot leave the grid", () => {
    expect(dragPreview("move", { x: 5000, y: -999 }, grid, { dx: 0, dy: 0 }, w)).toMatchObject({ x: 8, y: 0 });
    expect(dragPreview("move", { x: -999, y: 0 }, grid, { dx: 0, dy: 0 }, w).x).toBe(0);
  });
  it("resizes from the corner to the pointer, within limits", () => {
    expect(dragPreview("resize", { x: 100 + 9 * 100, y: 50 + 6 * 84 }, grid, { dx: 0, dy: 0 }, w)).toMatchObject({ x: 2, y: 1, w: 7, h: 5 });
    expect(dragPreview("resize", { x: 0, y: 0 }, grid, { dx: 0, dy: 0 }, w)).toMatchObject({ w: 3, h: 2 }); // minimums
    expect(dragPreview("resize", { x: 99999, y: 50 + 20 * 84 }, grid, { dx: 0, dy: 0 }, w).w).toBe(10); // stops at the right edge
  });
});

describe("persistence shape", () => {
  it("round-trips through the schema and tolerates damage", () => {
    const d = build(3);
    expect(dashboardSchema.parse(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(readDashboard({ dashboard: d })).toEqual(d);
    expect(readDashboard(undefined)).toEqual(emptyDashboard());
    expect(readDashboard({ dashboard: { widgets: [{ id: "x", x: 99 }] } })).toEqual(emptyDashboard());
  });
});
