"use client";

import { ArrowRightLeft, ChevronsDownUp, ChevronsUpDown, Copy, CornerDownRight, Maximize2, MousePointerClick, Pencil, Plus, Trash2, Unlink } from "lucide-react";
import { ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator } from "@/components/ui/context-menu";
import { canDelete, NODE_KINDS } from "@/lib/engine";
import { laneIndexOf, readLanes } from "@/lib/engine/lanes";
import { getExtras } from "@/lib/engine/semantics";
import { mindTree } from "@/lib/engine/mindmap-tree";
import { useEditor } from "./context";

/** What was right-clicked. Positions are in canvas coordinates, so a new item lands where you clicked. */
export type MenuTarget =
  | { kind: "pane"; position: { x: number; y: number } }
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string };

const NOUN = { flowchart: "step", mindmap: "branch", conceptmap: "concept", timeline: "event" } as const;

/**
 * The right-click menu on the canvas. Every entry is also reachable from the
 * toolbar, the Inspector or a keyboard shortcut; this is the quick route.
 */
export function CanvasMenu({ target, onFit }: { target: MenuTarget; onFit: () => void }) {
  const ed = useEditor();
  const { doc } = ed;
  const type = doc.type as keyof typeof NOUN;
  const kinds = type in NOUN ? NODE_KINDS[type as "flowchart" | "mindmap" | "conceptmap" | "timeline"] : [];

  if (target.kind === "edge") {
    return (
      <ContextMenuContent aria-label="Connection actions">
        <ContextMenuItem destructive onSelect={ed.removeSelection}>
          <Unlink aria-hidden="true" /> Delete connection
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }

  if (target.kind === "pane") {
    const { position } = target;
    return (
      <ContextMenuContent aria-label="Canvas actions">
        {type === "flowchart" && (
          <>
            <ContextMenuLabel>Add here</ContextMenuLabel>
            {kinds.map((k) => (
              <ContextMenuItem key={k.kind} onSelect={() => ed.addItem({ kind: k.kind, position })}>
                <Plus aria-hidden="true" /> {k.label}
              </ContextMenuItem>
            ))}
          </>
        )}
        {type === "conceptmap" && (
          <ContextMenuItem onSelect={() => ed.addItem({ kind: "concept", position })}>
            <Plus aria-hidden="true" /> Add concept here
          </ContextMenuItem>
        )}
        {type === "mindmap" && (
          <ContextMenuItem disabled={doc.nodes.length > 0} onSelect={ed.addFirst}>
            <Plus aria-hidden="true" /> Add central topic
          </ContextMenuItem>
        )}
        {type === "timeline" && (
          <ContextMenuItem onSelect={() => ed.addItem({})}>
            <Plus aria-hidden="true" /> Add event
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem disabled={doc.nodes.length === 0} onSelect={ed.selectAll}>
          <MousePointerClick aria-hidden="true" /> Select all
        </ContextMenuItem>
        <ContextMenuItem onSelect={onFit}>
          <Maximize2 aria-hidden="true" /> Fit to screen
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }

  const node = doc.nodes.find((n) => n.id === target.id);
  if (!node) return null;
  const tree = type === "mindmap" ? mindTree(doc) : undefined;
  const hasParent = Boolean(tree?.parent.get(node.id));
  const hasChildren = Boolean(tree?.children.get(node.id)?.length);
  const collapsed = Boolean(getExtras(node).collapsed);
  const deletable = canDelete(doc, [node.id]);
  const lanes = readLanes(doc);
  // After an "End" step nothing follows; "Start" never follows another step.
  const followers = type === "flowchart" ? (node.type === "end" ? [] : kinds.filter((k) => k.kind !== "start")) : [];

  return (
    <ContextMenuContent aria-label={`Actions for ${node.label}`}>
      {type === "flowchart" && followers.length > 0 && (
        <>
          <ContextMenuLabel>Add connected</ContextMenuLabel>
          {followers.map((k) => (
            <ContextMenuItem key={k.kind} onSelect={() => ed.addItem({ kind: k.kind, from: node.id })}>
              <CornerDownRight aria-hidden="true" /> {k.label}
            </ContextMenuItem>
          ))}
        </>
      )}
      {type === "conceptmap" && (
        <ContextMenuItem onSelect={() => ed.addItem({ kind: "concept", from: node.id })}>
          <CornerDownRight aria-hidden="true" /> Add related concept
        </ContextMenuItem>
      )}
      {type === "mindmap" && (
        <>
          <ContextMenuItem onSelect={() => ed.addChildOf(node.id)}>
            <CornerDownRight aria-hidden="true" /> Add branch
          </ContextMenuItem>
          <ContextMenuItem disabled={!hasParent} onSelect={ed.addSibling}>
            <Plus aria-hidden="true" /> Add sibling
          </ContextMenuItem>
          {hasChildren && (
            <ContextMenuItem onSelect={() => ed.toggleCollapse(node.id)}>
              {collapsed ? <ChevronsUpDown aria-hidden="true" /> : <ChevronsDownUp aria-hidden="true" />} {collapsed ? "Expand branch" : "Collapse branch"}
            </ContextMenuItem>
          )}
        </>
      )}
      {type === "timeline" && (
        <ContextMenuItem onSelect={() => ed.addItem({ from: node.id })}>
          <CornerDownRight aria-hidden="true" /> Add event after
        </ContextMenuItem>
      )}
      {lanes.length > 1 && (
        <>
          <ContextMenuSeparator />
          <ContextMenuLabel>Move to lane</ContextMenuLabel>
          {lanes.map((l, i) => (
            <ContextMenuItem key={l} disabled={i === laneIndexOf(node, lanes)} onSelect={() => ed.assignLane(l)}>
              <ArrowRightLeft aria-hidden="true" /> {l}
            </ContextMenuItem>
          ))}
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => ed.startEdit(node.id)}>
        <Pencil aria-hidden="true" /> Rename
      </ContextMenuItem>
      <ContextMenuItem onSelect={ed.duplicateSelection}>
        <Copy aria-hidden="true" /> Duplicate
      </ContextMenuItem>
      <ContextMenuItem destructive disabled={!deletable} onSelect={ed.removeSelection}>
        <Trash2 aria-hidden="true" /> Delete {type === "mindmap" && hasChildren ? `${NOUN[type]} and its sub-branches` : NOUN[type] ?? "item"}
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
