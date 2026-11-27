"use client";

import { createContext, useContext } from "react";
import type { IRViewport, VisualisationIR } from "@/types/visualisation";

export interface Selection {
  nodes: string[];
  edges: string[];
}

export const EMPTY_SELECTION: Selection = { nodes: [], edges: [] };

/** What the canvas and node views need from the editor, without prop-drilling. */
export interface EditorContextValue {
  doc: VisualisationIR;
  selection: Selection;
  editingId: string | undefined;
  setSelection: (s: Selection) => void;
  startEdit: (id: string) => void;
  commitLabel: (id: string, label: string) => void;
  cancelEdit: () => void;
  toggleCollapse: (id: string) => void;
  addChildOf: (id: string) => void;
  addFirst: () => void;
  moveNodes: (positions: Record<string, { x: number; y: number }>) => void;
  connect: (source: string, target: string) => void;
  setViewport: (vp: IRViewport) => void;
}

const Ctx = createContext<EditorContextValue | null>(null);
export const EditorProvider = Ctx.Provider;

export function useEditor(): EditorContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEditor must be used inside the editor.");
  return v;
}

/** Drop ids that no longer exist (after undo, delete or a type switch). */
export function liveSelection(doc: VisualisationIR, s: Selection): Selection {
  const nodes = s.nodes.filter((id) => doc.nodes.some((n) => n.id === id));
  const edges = s.edges.filter((id) => doc.edges.some((e) => e.id === id));
  return nodes.length === s.nodes.length && edges.length === s.edges.length ? s : { nodes, edges };
}
