import { z } from "zod";
import { createId } from "@/lib/utils/id";
import { chartConfigSchema, type ChartConfig } from "./config";

export const GRID_COLUMNS = 12;
export const MIN_W = 3;
export const MIN_H = 2;
export const MAX_H = 12;
export const MAX_WIDGETS = 24;
/** Height of one grid row on screen, in pixels. */
export const ROW_PX = 84;

export const widgetSchema = z.object({
  id: z.string().min(1).max(128),
  chart: chartConfigSchema,
  x: z.number().int().min(0).max(GRID_COLUMNS - 1),
  y: z.number().int().min(0).max(500),
  w: z.number().int().min(MIN_W).max(GRID_COLUMNS),
  h: z.number().int().min(MIN_H).max(MAX_H),
});
export const dashboardSchema = z.object({ widgets: z.array(widgetSchema).max(MAX_WIDGETS).default([]) });

export type Widget = z.infer<typeof widgetSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export const emptyDashboard = (): Dashboard => ({ widgets: [] });

/** Read a dashboard from document options, tolerating missing or damaged values. */
export function readDashboard(options: Record<string, unknown> | undefined): Dashboard {
  const r = dashboardSchema.safeParse(options?.dashboard);
  return r.success ? r.data : emptyDashboard();
}

type Box = Pick<Widget, "x" | "y" | "w" | "h">;
const collides = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const clampBox = <T extends Box>(w: T): T => {
  const width = Math.min(GRID_COLUMNS, Math.max(MIN_W, Math.round(w.w)));
  return { ...w, w: width, h: Math.min(MAX_H, Math.max(MIN_H, Math.round(w.h))), x: Math.min(GRID_COLUMNS - width, Math.max(0, Math.round(w.x))), y: Math.max(0, Math.round(w.y)) };
};

/**
 * Lay widgets out without overlap and with gravity (no gaps above). The
 * `pinned` widget keeps the position it asked for where possible; everything
 * else flows around it. Deterministic.
 */
export function arrange(widgets: readonly Widget[], pinned?: string): Widget[] {
  const items = widgets.map(clampBox);
  const pin = items.find((w) => w.id === pinned);
  const rest = items.filter((w) => w.id !== pinned).sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: Widget[] = pin ? [pin] : [];
  for (const w of rest) {
    let y = 0;
    while (placed.some((p) => collides({ ...w, y }, p))) y++;
    placed.push({ ...w, y });
  }
  if (pin) {
    const others = placed.filter((p) => p.id !== pin.id);
    let y = 0;
    while (others.some((p) => collides({ ...pin, y }, p)) && y < pin.y) y++;
    // Float up to the first gap, but never above where it was asked to be unless that spot is free.
    let up = pin.y;
    while (up > 0 && !others.some((p) => collides({ ...pin, y: up - 1 }, p))) up--;
    placed[0] = { ...pin, y: others.some((p) => collides({ ...pin, y: up }, p)) ? y : up };
  }
  const order = new Map(widgets.map((w, i) => [w.id, i]));
  return placed.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

/** First free place for a new widget of size w×h, scanning left to right, top to bottom. */
function freeSlot(widgets: readonly Widget[], w: number, h: number): { x: number; y: number } {
  for (let y = 0; ; y++) {
    for (let x = 0; x <= GRID_COLUMNS - w; x++) {
      if (!widgets.some((p) => collides({ x, y, w, h }, p))) return { x, y };
    }
  }
}

export function addWidget(dash: Dashboard, chart: ChartConfig, size: { w: number; h: number } = { w: 6, h: 4 }): { dashboard: Dashboard; id: string } {
  if (dash.widgets.length >= MAX_WIDGETS) return { dashboard: dash, id: "" };
  const { w, h } = clampBox({ x: 0, y: 0, ...size });
  const id = createId();
  const widget: Widget = { id, chart, w, h, ...freeSlot(dash.widgets, w, h) };
  return { dashboard: { widgets: arrange([...dash.widgets, widget]) }, id };
}

export function removeWidget(dash: Dashboard, id: string): Dashboard {
  return dash.widgets.some((w) => w.id === id) ? { widgets: arrange(dash.widgets.filter((w) => w.id !== id)) } : dash;
}

export function moveWidget(dash: Dashboard, id: string, x: number, y: number): Dashboard {
  const cur = dash.widgets.find((w) => w.id === id);
  if (!cur) return dash;
  const next = clampBox({ ...cur, x, y });
  if (next.x === cur.x && next.y === cur.y) return dash;
  return { widgets: arrange(dash.widgets.map((w) => (w.id === id ? next : w)), id) };
}

export function resizeWidget(dash: Dashboard, id: string, w: number, h: number): Dashboard {
  const cur = dash.widgets.find((x) => x.id === id);
  if (!cur) return dash;
  const next = clampBox({ ...cur, w: Math.min(w, GRID_COLUMNS - cur.x), h });
  if (next.w === cur.w && next.h === cur.h) return dash;
  return { widgets: arrange(dash.widgets.map((x) => (x.id === id ? next : x)), id) };
}

export function updateWidgetChart(dash: Dashboard, id: string, update: (c: ChartConfig) => ChartConfig): Dashboard {
  let changed = false;
  const widgets = dash.widgets.map((w) => {
    if (w.id !== id) return w;
    const chart = update(w.chart);
    if (chart === w.chart) return w;
    changed = true;
    return { ...w, chart };
  });
  return changed ? { widgets } : dash;
}

export function duplicateWidget(dash: Dashboard, id: string): { dashboard: Dashboard; id: string } {
  const src = dash.widgets.find((w) => w.id === id);
  if (!src || dash.widgets.length >= MAX_WIDGETS) return { dashboard: dash, id: "" };
  const copyId = createId();
  const title = src.chart.title ? `${src.chart.title} (copy)`.slice(0, 200) : "";
  const slot = freeSlot(dash.widgets, src.w, src.h);
  return { dashboard: { widgets: arrange([...dash.widgets, { ...structuredClone(src), id: copyId, chart: { ...structuredClone(src.chart), title }, ...slot }]) }, id: copyId };
}

/** Reading order for small screens, where the grid collapses to one column. */
export const readingOrder = (widgets: readonly Widget[]): Widget[] => [...widgets].sort((a, b) => a.y - b.y || a.x - b.x);

/** Map a pointer position inside the grid to a cell. */
export function cellAt(px: number, py: number, gridWidth: number): { col: number; row: number } {
  const cell = gridWidth / GRID_COLUMNS;
  return { col: Math.floor(px / cell), row: Math.floor(py / ROW_PX) };
}

export const gridHeightRows = (widgets: readonly Widget[]): number => Math.max(MIN_H * 2, ...widgets.map((w) => w.y + w.h));

export interface DragPreview {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where a widget would land for a pointer position. `origin` is the grid's top-left
 * on screen and `grab` the pointer's offset inside the widget when the drag began.
 */
export function dragPreview(
  mode: "move" | "resize",
  pointer: { x: number; y: number },
  grid: { left: number; top: number; width: number },
  grab: { dx: number; dy: number },
  widget: Pick<Widget, "x" | "y" | "w" | "h">,
): DragPreview {
  const cell = grid.width / GRID_COLUMNS;
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  const px = pointer.x - grid.left, py = pointer.y - grid.top;
  if (mode === "move") {
    return { x: clamp(Math.round((px - grab.dx) / cell), 0, GRID_COLUMNS - widget.w), y: Math.max(0, Math.round((py - grab.dy) / ROW_PX)), w: widget.w, h: widget.h };
  }
  return { x: widget.x, y: widget.y, w: clamp(Math.round(px / cell) - widget.x, MIN_W, GRID_COLUMNS - widget.x), h: Math.max(MIN_H, Math.round(py / ROW_PX) - widget.y) };
}
