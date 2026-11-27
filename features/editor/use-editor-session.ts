"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addNode, canDelete, deleteEdges, deleteNodes, duplicateNodes, moveNodes, connect, toggleCollapse, updateNode } from "@/lib/engine";
import { mindTree } from "@/lib/engine/mindmap-tree";
import type { UpdateOptions } from "@/features/visualisation/use-visualisation-editor";
import type { IRViewport, VisualisationIR } from "@/types/visualisation";
import { EMPTY_SELECTION, liveSelection, type EditorContextValue, type Selection } from "./context";

type Update = (updater: (d: VisualisationIR) => VisualisationIR, options?: UpdateOptions) => void;

/**
 * Selection, in-place editing and the add/remove/duplicate commands, shared by
 * the canvas, toolbar, inspector and keyboard shortcuts so they cannot drift.
 */
export function useEditorSession(doc: VisualisationIR, update: Update) {
  const [rawSelection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [editingId, setEditingId] = useState<string>();
  const selection = useMemo(() => liveSelection(doc, rawSelection), [doc, rawSelection]);
  const docRef = useRef(doc);
  const selRef = useRef(selection);
  // Commands read the latest committed values, so they stay stable between renders.
  useEffect(() => {
    docRef.current = doc;
    selRef.current = selection;
  });

  const only = () => (selRef.current.nodes.length === 1 && selRef.current.edges.length === 0 ? selRef.current.nodes[0] : undefined);

  const focusNew = useCallback((id: string) => {
    if (!id) return;
    setSelection({ nodes: [id], edges: [] });
    setEditingId(id);
  }, []);

  const apply = useCallback(
    (next: VisualisationIR, options?: UpdateOptions) => {
      update(() => next, options);
    },
    [update],
  );

  const add = useCallback(
    (kind?: string, from?: string) => {
      const r = addNode(docRef.current, { kind, from: from ?? only() });
      if (r.doc !== docRef.current) {
        apply(r.doc);
        focusNew(r.id);
      }
    },
    [apply, focusNew],
  );

  const addFirst = useCallback(() => add(docRef.current.type === "mindmap" ? "topic" : undefined, undefined), [add]);
  const addChildOf = useCallback((id: string) => add(undefined, id), [add]);

  const addSibling = useCallback(() => {
    const id = only();
    const d = docRef.current;
    if (!id || d.type !== "mindmap") return;
    const parent = mindTree(d).parent.get(id);
    if (parent) add(undefined, parent);
  }, [add]);

  const remove = useCallback(() => {
    const d = docRef.current;
    const s = selRef.current;
    let next = d;
    if (s.edges.length) next = deleteEdges(next, s.edges);
    if (s.nodes.length && canDelete(next, s.nodes)) next = deleteNodes(next, s.nodes);
    if (next !== d) {
      apply(next);
      setSelection(EMPTY_SELECTION);
      setEditingId(undefined);
    }
  }, [apply]);

  const duplicate = useCallback(() => {
    const s = selRef.current;
    if (!s.nodes.length) return;
    const r = duplicateNodes(docRef.current, s.nodes);
    if (r.ids.length) {
      apply(r.doc);
      setSelection({ nodes: r.ids, edges: [] });
    }
  }, [apply]);

  const selectAll = useCallback(() => setSelection({ nodes: docRef.current.nodes.map((n) => n.id), edges: [] }), []);

  const ctx: EditorContextValue = {
    doc,
    selection,
    editingId,
    setSelection,
    startEdit: (id) => {
      setSelection({ nodes: [id], edges: [] });
      setEditingId(id);
    },
    commitLabel: (id, label) => {
      setEditingId(undefined);
      update((d) => updateNode(d, id, { label }), { coalesceKey: `label:${id}` });
    },
    cancelEdit: () => setEditingId(undefined),
    toggleCollapse: (id) => update((d) => toggleCollapse(d, id)),
    addChildOf,
    addFirst,
    moveNodes: (positions) => update((d) => moveNodes(d, positions)),
    connect: (source, target) => update((d) => connect(d, source, target)),
    setViewport: (vp: IRViewport) =>
      update((d) => (d.viewport.x === vp.x && d.viewport.y === vp.y && d.viewport.zoom === vp.zoom ? d : { ...d, viewport: vp }), { history: false }),
  };

  return { selection, setSelection, editingId, setEditingId, add, addFirst, addChildOf, addSibling, remove, duplicate, selectAll, ctx };
}

export type EditorSession = ReturnType<typeof useEditorSession>;
