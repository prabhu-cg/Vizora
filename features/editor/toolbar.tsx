"use client";

import { useReactFlow } from "@xyflow/react";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Copy, Keyboard, Maximize2, Plus, Redo2, RotateCcw, Trash2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select } from "@/components/ui/input";
import { canDelete, NODE_KINDS, resetLayout, setAllCollapsed, setLayout } from "@/lib/engine";
import type { UpdateOptions } from "@/features/visualisation/use-visualisation-editor";
import type { VisualisationIR } from "@/types/visualisation";
import { PanelControls } from "@/components/workspace/workspace-frame";
import type { Chrome } from "@/components/workspace/use-workspace-chrome";
import type { EditorSession } from "./use-editor-session";

type Update = (updater: (d: VisualisationIR) => VisualisationIR, options?: UpdateOptions) => void;

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      {children}
    </div>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-border sm:block" />;

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Button variant="ghost" size="icon" className="size-9" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}

export function EditorToolbar({
  doc,
  session,
  update,
  undo,
  redo,
  canUndo,
  canRedo,
  onHelp,
  chrome,
}: {
  chrome?: Chrome;
  doc: VisualisationIR;
  session: EditorSession;
  update: Update;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onHelp: () => void;
}) {
  const rf = useReactFlow();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const sel = session.selection;
  const hasSelection = sel.nodes.length > 0 || sel.edges.length > 0;
  const deletable = sel.edges.length > 0 || canDelete(doc, sel.nodes);
  const kinds = (doc.type === "flowchart" || doc.type === "timeline") ? NODE_KINDS[doc.type] : [];

  return (
    <div role="toolbar" aria-label="Editing tools" className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-border bg-surface px-3 py-1.5">
      <Group label="History">
        <IconButton label="Undo (Ctrl/⌘ + Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 aria-hidden="true" />
        </IconButton>
        <IconButton label="Redo (Ctrl/⌘ + Shift + Z)" onClick={redo} disabled={!canRedo}>
          <Redo2 aria-hidden="true" />
        </IconButton>
      </Group>
      <Divider />

      <Group label="Add">
        {kinds.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus aria-hidden="true" /> Add <ChevronDown aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {kinds.map((k) => (
                <DropdownMenuItem key={k.kind} onSelect={() => session.add(k.kind)}>
                  {k.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" size="sm" onClick={() => (doc.nodes.length === 0 ? session.addFirst() : session.add())}>
            <Plus aria-hidden="true" /> {doc.type === "mindmap" ? (doc.nodes.length === 0 ? "Central topic" : "Branch") : "Concept"}
          </Button>
        )}
        {doc.type === "mindmap" && doc.nodes.length > 0 && (
          <Button variant="ghost" size="sm" onClick={session.addSibling} disabled={sel.nodes.length !== 1}>
            Sibling
          </Button>
        )}
        <IconButton label="Duplicate (Ctrl/⌘ + D)" onClick={session.duplicate} disabled={sel.nodes.length === 0}>
          <Copy aria-hidden="true" />
        </IconButton>
        <IconButton label="Delete (Delete)" onClick={session.remove} disabled={!hasSelection || !deletable}>
          <Trash2 aria-hidden="true" />
        </IconButton>
      </Group>
      <Divider />

      <Group label="Layout">
        {doc.type === "flowchart" && (
          <Select aria-label="Layout direction" className="h-9 w-auto text-sm" value={doc.layout.direction} onChange={(e) => update((d) => setLayout(d, { direction: e.target.value as "TB" | "LR" }))}>
            <option value="TB">Top to bottom</option>
            <option value="LR">Left to right</option>
          </Select>
        )}
        {doc.type === "conceptmap" && (
          <>
            <Select aria-label="Layout style" className="h-9 w-auto text-sm" value={doc.layout.algorithm === "force" ? "force" : "layered"} onChange={(e) => update((d) => setLayout(d, { algorithm: e.target.value as "force" | "layered" }))}>
              <option value="layered">Hierarchy</option>
              <option value="force">Network</option>
            </Select>
            {doc.layout.algorithm !== "force" && (
              <Select aria-label="Layout direction" className="h-9 w-auto text-sm" value={doc.layout.direction} onChange={(e) => update((d) => setLayout(d, { direction: e.target.value as "TB" | "LR" }))}>
                <option value="TB">Top to bottom</option>
                <option value="LR">Left to right</option>
              </Select>
            )}
          </>
        )}
        {doc.type === "timeline" && (
          <Select aria-label="Timeline orientation" className="h-9 w-auto text-sm" value={doc.layout.direction === "TB" ? "TB" : "LR"} onChange={(e) => update((d) => setLayout(d, { direction: e.target.value as "TB" | "LR" }))}>
            <option value="LR">Horizontal</option>
            <option value="TB">Vertical</option>
          </Select>
        )}
        {doc.type === "mindmap" && (
          <>
            <IconButton label="Expand all branches" onClick={() => update((d) => setAllCollapsed(d, false))}>
              <ChevronsUpDown aria-hidden="true" />
            </IconButton>
            <IconButton label="Collapse all branches" onClick={() => update((d) => setAllCollapsed(d, true))}>
              <ChevronsDownUp aria-hidden="true" />
            </IconButton>
          </>
        )}
        {(doc.type === "flowchart" || doc.type === "conceptmap") && (
          <Button variant="ghost" size="sm" onClick={() => { update((d) => resetLayout(d)); requestAnimationFrame(() => alive.current && void rf.fitView({ padding: 0.2, maxZoom: 1.1 })); }}>
            <RotateCcw aria-hidden="true" /> Reset layout
          </Button>
        )}
      </Group>
      <Divider />

      <Group label="View">
        <IconButton label="Zoom in (+)" onClick={() => void rf.zoomIn()}>
          <ZoomIn aria-hidden="true" />
        </IconButton>
        <IconButton label="Zoom out (−)" onClick={() => void rf.zoomOut()}>
          <ZoomOut aria-hidden="true" />
        </IconButton>
        <IconButton label="Fit to screen (Ctrl/⌘ + 0)" onClick={() => void rf.fitView({ padding: 0.2, maxZoom: 1.1 })}>
          <Maximize2 aria-hidden="true" />
        </IconButton>
        {chrome && <PanelControls chrome={chrome} left="Source" right="Inspector" />}
        <IconButton label="Keyboard shortcuts (?)" onClick={onHelp}>
          <Keyboard aria-hidden="true" />
        </IconButton>
      </Group>
    </div>
  );
}
