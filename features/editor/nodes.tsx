"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatDateValue } from "@/lib/engine/interpret/dates";
import { COLOR_VAR, getColor, getExtras } from "@/lib/engine/semantics";
import { STEM } from "@/lib/engine/layout/timeline";
import type { IRNode } from "@/types/visualisation";
import { cn } from "@/lib/utils/cn";
import { useEditor } from "./context";
import type { AxisData, ItemData, LaneData } from "./flow-adapter";

const SIDES = [
  [Position.Top, "top"],
  [Position.Right, "right"],
  [Position.Bottom, "bottom"],
  [Position.Left, "left"],
] as const;

/** Handles on every side: invisible anchors for edges, visible grips when connecting is allowed. */
function Handles({ connectable }: { connectable: boolean }) {
  return (
    <>
      {SIDES.map(([pos, id]) => (
        <Handle
          key={id}
          id={id}
          type="source"
          position={pos}
          isConnectable={connectable}
          className={cn(
            "!size-2.5 !border !border-border-strong !bg-card",
            connectable ? "opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" : "!pointer-events-none !opacity-0",
          )}
        />
      ))}
    </>
  );
}

/** In-place text editor: Enter saves, Shift+Enter adds a line, Escape cancels, blur saves. */
function InlineEditor({ node }: { node: IRNode }) {
  const { commitLabel, cancelEdit } = useEditor();
  const [value, setValue] = useState(node.label);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save) commitLabel(node.id, value);
    else cancelEdit();
  };
  return (
    <textarea
      ref={ref}
      value={value}
      aria-label={`Edit text for ${node.label}`}
      rows={Math.min(5, Math.max(1, value.split("\n").length))}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      }}
      className="nodrag nowheel w-full resize-none rounded-sm border border-ring bg-card px-1 text-center text-sm text-foreground outline-none"
    />
  );
}

function Label({ node, className }: { node: IRNode; className?: string }) {
  const { editingId } = useEditor();
  if (editingId === node.id) return <InlineEditor node={node} />;
  return <span className={cn("whitespace-pre-wrap break-words text-center text-sm leading-[19px] text-foreground [overflow-wrap:anywhere]", className)}>{node.label}</span>;
}

const tint = "color-mix(in srgb, var(--c) 14%, var(--card))";

function FlowShape({ node, selected }: { node: IRNode; selected: boolean }) {
  const colourKey = getColor(node);
  const style = { "--c": COLOR_VAR[colourKey === "default" ? "default" : colourKey] } as unknown as React.CSSProperties;
  const ring = selected ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "";
  const poly = (pts: string) => (
    <svg aria-hidden="true" className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polygon points={pts} fill={tint} stroke="var(--c)" strokeWidth={colourKey === "default" ? 1.5 : 2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
  if (node.type === "decision") {
    return (
      <div style={style} className={cn("relative size-full", selected && "[&_polygon]:stroke-[var(--ring)]")}>
        {poly("50,0 100,50 50,100 0,50")}
        <div className="absolute inset-0 flex items-center justify-center px-[19%]"><Label node={node} /></div>
        {selected && <span aria-hidden="true" className="pointer-events-none absolute inset-0 -m-1 rounded-sm outline-2 outline-offset-2 outline-ring [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]" />}
      </div>
    );
  }
  if (node.type === "io") {
    return (
      <div style={style} className="relative size-full">
        {poly("9,0 100,0 91,100 0,100")}
        <div className="absolute inset-0 flex items-center justify-center px-[12%]"><Label node={node} /></div>
        {selected && <span aria-hidden="true" className="pointer-events-none absolute inset-0 outline-2 outline-offset-2 outline-ring" />}
      </div>
    );
  }
  const terminal = node.type === "start" || node.type === "end";
  return (
    <div
      style={{ ...style, ...(terminal && colourKey === "default" ? { "--c": "var(--primary-hover)", background: "var(--primary-soft)" } : { background: tint }) }}
      className={cn("flex size-full items-center justify-center border-[1.5px] border-[var(--c)] px-3", terminal ? "rounded-full font-semibold" : "rounded-input", ring)}
    >
      <Label node={node} className={terminal ? "font-semibold" : undefined} />
    </div>
  );
}

function MindShape({ node, data, selected }: { node: IRNode; data: ItemData; selected: boolean }) {
  const { doc, toggleCollapse, addChildOf } = useEditor();
  const colourKey = getColor(node);
  const root = data.isRoot === true || node.type === "topic";
  const collapsed = getExtras(node).collapsed === true;
  const count = data.childCount ?? 0;
  const outward = data.outward ?? "right";
  const Chevron = (collapsed ? outward === "right" : outward === "left") ? ChevronRight : ChevronLeft;
  void doc;
  return (
    <div
      style={{ "--c": COLOR_VAR[colourKey], ...(root ? { background: "var(--primary)", borderColor: "var(--primary-hover)" } : { background: tint }) } as unknown as React.CSSProperties}
      className={cn(
        "relative flex size-full items-center justify-center border-2 px-4",
        root ? "rounded-[28px] border-[var(--primary-hover)] font-semibold" : "rounded-full border-[var(--c)]",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
    >
      <Label node={node} className={root ? "font-semibold !text-primary-foreground" : undefined} />
      {count > 0 && !root && (
        <button
          type="button"
          aria-label={`${collapsed ? "Expand" : "Collapse"} branch ${node.label}`}
          aria-expanded={!collapsed}
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse(node.id);
          }}
          className={cn(
            "nodrag absolute top-1/2 flex h-6 min-w-6 -translate-y-1/2 items-center justify-center gap-0.5 rounded-full border border-border-strong bg-card px-1 text-[11px] font-semibold text-foreground hover:bg-muted",
            outward === "right" ? "left-full ml-1.5" : "right-full mr-1.5",
          )}
        >
          <Chevron className="size-3.5" aria-hidden="true" />
          {collapsed && <span>{count}</span>}
        </button>
      )}
      {selected && (
        <button
          type="button"
          aria-label={`Add a branch under ${node.label}`}
          onClick={(e) => {
            e.stopPropagation();
            addChildOf(node.id);
          }}
          className={cn(
            "nodrag absolute top-full mt-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary-hover",
            "left-1/2 -translate-x-1/2",
          )}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function ConceptShape({ node, selected }: { node: IRNode; selected: boolean }) {
  const colourKey = getColor(node);
  return (
    <div
      style={{ "--c": COLOR_VAR[colourKey], background: tint } as unknown as React.CSSProperties}
      className={cn("flex size-full items-center justify-center rounded-[22px] border-[1.5px] border-[var(--c)] px-4", selected && "ring-2 ring-ring ring-offset-2 ring-offset-background")}
    >
      <Label node={node} />
    </div>
  );
}

function TimelineShape({ node, data, selected }: { node: IRNode; data: ItemData; selected: boolean }) {
  const { doc } = useEditor();
  const ex = getExtras(node);
  const colourKey = getColor(node);
  const milestone = node.type === "milestone";
  const horizontal = doc.layout.direction !== "TB" && doc.layout.direction !== "BT";
  const before = data.side === "before";
  const date = ex.dateLabel ?? (ex.date ? formatDateValue(ex.date) : undefined);
  const accent = colourKey === "default" ? "var(--input)" : COLOR_VAR[colourKey];
  const stem = horizontal
    ? before ? { top: "100%", left: "50%", width: 2, height: STEM, transform: "translateX(-1px)" } : { bottom: "100%", left: "50%", width: 2, height: STEM, transform: "translateX(-1px)" }
    : before ? { left: "100%", top: "50%", height: 2, width: STEM, transform: "translateY(-1px)" } : { right: "100%", top: "50%", height: 2, width: STEM, transform: "translateY(-1px)" };
  const dot = horizontal
    ? before ? { top: `calc(100% + ${STEM}px)`, left: "50%" } : { bottom: `calc(100% + ${STEM}px)`, left: "50%" }
    : before ? { left: `calc(100% + ${STEM}px)`, top: "50%" } : { right: `calc(100% + ${STEM}px)`, top: "50%" };
  return (
    <div
      style={{ ...(colourKey === "default" ? {} : { "--c": accent, background: tint }), borderColor: accent } as unknown as React.CSSProperties}
      className={cn("relative size-full rounded-card border-[1.5px] bg-card px-3.5 py-2.5", milestone && "border-2", selected && "ring-2 ring-ring ring-offset-2 ring-offset-background")}
    >
      <span aria-hidden="true" className="pointer-events-none absolute" style={{ ...stem, background: accent }} />
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2", milestone ? "rotate-45 border-2 border-primary-hover bg-primary" : "rounded-full border-[3px] bg-card")}
        style={{ ...dot, ...(milestone ? {} : { borderColor: accent }) }}
      />
      {date && <p className="text-[11.5px] font-semibold leading-4 text-muted-foreground">{date}</p>}
      <Label node={node} className="!block !text-left font-semibold" />
      {ex.description && <p className="mt-1 line-clamp-3 text-xs leading-[17px] text-body">{ex.description}</p>}
    </div>
  );
}

export function ItemNode({ data, selected }: NodeProps) {
  const d = data as ItemData & { node: IRNode };
  const { doc } = useEditor();
  const connectable = doc.type === "flowchart" || doc.type === "conceptmap";
  return (
    <div className="group size-full">
      {doc.type === "flowchart" && <FlowShape node={d.node} selected={selected} />}
      {doc.type === "mindmap" && <MindShape node={d.node} data={d} selected={selected} />}
      {doc.type === "conceptmap" && <ConceptShape node={d.node} selected={selected} />}
      {doc.type === "timeline" && <TimelineShape node={d.node} data={d} selected={selected} />}
      <Handles connectable={connectable} />
    </div>
  );
}

export function AxisNode({ data }: NodeProps) {
  const d = data as AxisData;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none rounded-full bg-input"
      style={d.horizontal ? { width: d.length, height: 4, transform: "translateY(-2px)" } : { height: d.length, width: 4, transform: "translateX(-2px)" }}
    />
  );
}

/** One swimlane band: a tinted strip with its name. Purely a backdrop; steps are drawn above it. */
export function LaneNode({ data }: NodeProps) {
  const d = data as LaneData;
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none size-full border-b border-r border-border-strong", d.index % 2 === 0 ? "bg-surface/80" : "bg-muted/60")}
    >
      <span className={cn("absolute left-3 top-2 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]")}>{d.name}</span>
    </div>
  );
}

export const NODE_TYPES = { item: ItemNode, axis: AxisNode, lane: LaneNode };
