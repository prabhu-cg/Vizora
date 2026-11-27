"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { GRID_COLUMNS, MIN_H, ROW_PX, datasetOf, dragPreview, moveWidget, readingOrder, resizeWidget, type Dashboard, type Widget } from "@/lib/charts";
import type { VisualisationIR } from "@/types/visualisation";
import { WidgetTile } from "./widget-tile";

interface Drag {
  id: string;
  mode: "move" | "resize";
  /** Pointer offset inside the tile when the drag began, in px. */
  dx: number;
  dy: number;
  preview: { x: number; y: number; w: number; h: number };
}


/**
 * The dashboard grid: 12 columns on wide screens (drag to move, drag the
 * corner to resize, or use the arrow keys), a single column on small ones.
 * Pure presentation of the document; every change goes through the grid
 * functions in lib/charts/dashboard.
 */
export function DashboardCanvas({
  doc, dashboard, selectedId, onSelect, onChange, onDelete, onDuplicate,
}: {
  doc: VisualisationIR;
  dashboard: Dashboard;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  onChange: (fn: (d: Dashboard) => Dashboard, coalesceKey?: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const grid = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<Drag>();
  const [wide, setWide] = useState(true);
  const live = useRef(dashboard);
  useEffect(() => {
    live.current = dashboard;
  });

  useEffect(() => {
    const mq = window.matchMedia?.("(min-width: 768px)");
    if (!mq) return;
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const start = useCallback((e: PointerEvent<HTMLElement>, w: Widget, mode: "move" | "resize") => {
    const el = grid.current;
    if (!el || e.button !== 0) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const cell = rect.width / GRID_COLUMNS;
    setDrag({ id: w.id, mode, dx: e.clientX - rect.left - w.x * cell, dy: e.clientY - rect.top - w.y * ROW_PX, preview: { x: w.x, y: w.y, w: w.w, h: w.h } });
    onSelect(w.id);
  }, [onSelect]);

  useEffect(() => {
    if (!drag) return;
    const el = grid.current;
    if (!el) return;
    const toCells = (e: globalThis.PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const w = live.current.widgets.find((x) => x.id === drag.id);
      return w ? dragPreview(drag.mode, { x: e.clientX, y: e.clientY }, rect, drag, w) : undefined;
    };
    const move = (e: globalThis.PointerEvent) => {
      const p = toCells(e);
      if (p) setDrag((d) => (d ? { ...d, preview: p } : d));
    };
    const up = (e: globalThis.PointerEvent) => {
      const p = toCells(e);
      setDrag(undefined);
      if (!p) return;
      onChange((d) => (drag.mode === "move" ? moveWidget(d, drag.id, p.x, p.y) : resizeWidget(d, drag.id, p.w, p.h)));
    };
    const cancel = () => setDrag(undefined);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [drag, onChange]);

  const rows = Math.max(MIN_H * 2, ...dashboard.widgets.map((w) => w.y + w.h), drag ? drag.preview.y + drag.preview.h : 0);

  return (
    <ul
      ref={grid}
      aria-label={`${doc.title}: dashboard charts`}
      className="grid grid-cols-1 content-start p-1.5 md:grid-cols-12"
      style={wide ? { gridAutoRows: `${ROW_PX}px`, minHeight: rows * ROW_PX } : undefined}
      onClick={(e) => e.target === e.currentTarget && onSelect(undefined)}
    >
      {(wide ? dashboard.widgets : readingOrder(dashboard.widgets)).map((w) => (
        <li
          key={w.id}
          className="p-1.5"
          style={wide ? { gridColumn: `${w.x + 1} / span ${w.w}`, gridRow: `${w.y + 1} / span ${w.h}` } : { height: Math.max(260, w.h * ROW_PX * 0.8) }}
        >
          <WidgetTile
            widget={w}
            dataset={datasetOf(doc, w.chart.datasetId)}
            selected={selectedId === w.id}
            dragging={drag?.id === w.id}
            handlers={{
              canDrag: wide,
              onSelect: () => onSelect(w.id),
              onDelete: () => onDelete(w.id),
              onDuplicate: () => onDuplicate(w.id),
              onDragStart: (e, mode) => start(e, w, mode),
              onNudge: (dx, dy, resize) => {
                onSelect(w.id);
                onChange((d) => (resize ? resizeWidget(d, w.id, w.w + dx, w.h + dy) : moveWidget(d, w.id, w.x + dx, w.y + dy)), `grid:${w.id}`);
              },
            }}
          />
        </li>
      ))}
      {drag && wide && (
        <li aria-hidden="true" className="pointer-events-none p-1.5" style={{ gridColumn: `${drag.preview.x + 1} / span ${drag.preview.w}`, gridRow: `${drag.preview.y + 1} / span ${drag.preview.h}` }}>
          <div className="size-full rounded-card border-2 border-dashed border-primary bg-primary-soft/40" />
        </li>
      )}
    </ul>
  );
}
