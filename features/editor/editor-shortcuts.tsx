"use client";

import { useReactFlow } from "@xyflow/react";
import { useEffect, useRef } from "react";
import type { VisualisationIR } from "@/types/visualisation";
import { isTreeType } from "@/lib/engine/semantics";
import { matchShortcut, shouldHandle } from "./shortcuts";
import type { EditorSession } from "./use-editor-session";

/** Binds the keyboard shortcuts to the editor. Renders nothing. Must sit inside ReactFlowProvider. */
export function EditorShortcuts({
  doc,
  session,
  undo,
  redo,
  onHelp,
}: {
  doc: VisualisationIR;
  session: EditorSession;
  undo: () => void;
  redo: () => void;
  onHelp: () => void;
}) {
  const rf = useReactFlow();
  const latest = useRef({ doc, session, undo, redo, onHelp, rf });
  useEffect(() => {
    latest.current = { doc, session, undo, redo, onHelp, rf };
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const action = matchShortcut(e);
      if (!action || !shouldHandle(action, e.target, document)) return;
      const { session: s, doc: d, undo: u, redo: r, onHelp: help, rf: flow } = latest.current;
      const one = s.selection.nodes.length === 1 ? s.selection.nodes[0] : undefined;
      let handled = true;
      switch (action) {
        case "undo": u(); break;
        case "redo": r(); break;
        case "duplicate": s.duplicate(); break;
        case "delete": if (s.selection.nodes.length || s.selection.edges.length) s.remove(); else handled = false; break;
        case "edit": if (one) s.setEditingId(one); else handled = false; break;
        case "add-child":
          // Only when an item has focus or is selected; otherwise Tab keeps moving through the page.
          if (one && (e.target as Element | null)?.closest?.(".react-flow__node")) s.addChildOf(one);
          else handled = false;
          break;
        case "add-sibling": if (isTreeType(d.type) && one) s.addSibling(); else handled = false; break;
        case "select-all": s.selectAll(); break;
        case "fit": void flow.fitView({ padding: 0.2, maxZoom: 1.1 }); break;
        case "zoom-in": void flow.zoomIn(); break;
        case "zoom-out": void flow.zoomOut(); break;
        case "deselect": s.setSelection({ nodes: [], edges: [] }); s.setEditingId(undefined); break;
        case "help": help(); break;
      }
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return null;
}
