"use client";

import { Copy, GripVertical, Trash2 } from "lucide-react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { ChartView } from "@/features/charts/chart-view";
import { useChartQuery } from "@/features/charts/chart-stage";
import { KIND_META, type Widget } from "@/lib/charts";
import { cn } from "@/lib/utils/cn";
import type { Dataset } from "@/types/visualisation";

export interface TileHandlers {
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (e: PointerEvent<HTMLElement>, mode: "move" | "resize") => void;
  /** Keyboard: arrows move by one cell; with `resize`, they resize instead. */
  onNudge: (dx: number, dy: number, resize: boolean) => void;
  /** Drag and resize need a pointer and a wide screen; small screens stack tiles. */
  canDrag: boolean;
}

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export function WidgetTile({ widget, dataset, selected, handlers, dragging }: { widget: Widget; dataset?: Dataset; selected: boolean; handlers: TileHandlers; dragging?: boolean }) {
  const result = useChartQuery(dataset, widget.chart);
  const name = widget.chart.title || `${KIND_META[widget.chart.kind].label} chart`;
  const key = (resize: boolean) => (e: KeyboardEvent<HTMLElement>) => {
    const d = ARROWS[e.key];
    if (!d) return;
    e.preventDefault();
    handlers.onNudge(d[0], d[1], resize || e.shiftKey);
  };
  return (
    <article
      aria-label={name}
      className={cn("relative flex size-full flex-col overflow-hidden rounded-card border bg-card transition-colors", selected ? "border-primary ring-2 ring-ring ring-offset-2 ring-offset-background" : "border-border", dragging && "opacity-60")}
    >
      <header className="flex items-center gap-1 border-b border-border bg-surface px-2 py-1">
        {handlers.canDrag && (
          <button
            type="button"
            aria-label={`Move ${name}. Use the arrow keys to move it, or hold Shift with the arrow keys to resize it.`}
            onPointerDown={(e) => handlers.onDragStart(e, "move")}
            onKeyDown={key(false)}
            className="flex size-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </button>
        )}
        <button type="button" aria-pressed={selected} onClick={handlers.onSelect} className="min-w-0 flex-1 truncate rounded-sm px-1 text-left text-sm font-semibold hover:text-primary-text" title={name}>
          {name}
          <span className="sr-only">{selected ? " (selected)" : ". Select to edit its settings."}</span>
        </button>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Duplicate ${name}`} onClick={handlers.onDuplicate}><Copy aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Delete ${name}`} onClick={handlers.onDelete}><Trash2 aria-hidden="true" /></Button>
      </header>
      <div className="min-h-0 flex-1 p-2">
        {!dataset ? (
          <p className="grid size-full place-items-center p-4 text-center text-sm text-muted-foreground">This chart&apos;s data has been removed. Choose another dataset in its settings.</p>
        ) : result && !result.ok ? (
          <p role="alert" className="grid size-full place-items-center p-4 text-center text-sm text-body">{result.error}</p>
        ) : result?.ok ? (
          <ChartView data={result.data} config={widget.chart} label={`${widget.chart.kind} chart: ${name}`} />
        ) : null}
      </div>
      {handlers.canDrag && (
        <button
          type="button"
          aria-label={`Resize ${name}. Use the arrow keys.`}
          onPointerDown={(e) => handlers.onDragStart(e, "resize")}
          onKeyDown={key(true)}
          className="absolute bottom-0 right-0 size-6 cursor-nwse-resize touch-none rounded-tl-md text-muted-foreground hover:bg-muted"
        >
          <svg viewBox="0 0 10 10" className="size-full p-1.5" aria-hidden="true"><path d="M9 3 3 9M9 6 6 9" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" /></svg>
        </button>
      )}
    </article>
  );
}
