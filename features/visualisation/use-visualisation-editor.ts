"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStorage } from "@/hooks/use-storage";
import type { VisualisationIR, VisualisationRecord } from "@/types/visualisation";
import { AutosaveController, type AutosaveState } from "./autosave";
import { History } from "./history";

export type EditorState =
  | { phase: "loading" }
  | { phase: "not-found" }
  | { phase: "error"; message: string }
  | {
      phase: "ready";
      projectId: string;
      document: VisualisationIR;
      /** Bumps when the document is replaced wholesale (load / conflict resolution) so views remount. */
      loadKey: number;
    };

const INITIAL_SAVE: AutosaveState = { status: "saved" };

export interface UpdateOptions {
  /** Edits with the same key within a second become one undo step (typing in a field). */
  coalesceKey?: string;
  /** Set false for changes that are not edits, such as panning (not undoable). */
  history?: boolean;
}

export function useVisualisationEditor(visualisationId: string) {
  const storage = useStorage();
  const [editor, setEditor] = useState<EditorState>({ phase: "loading" });
  const [save, setSave] = useState<AutosaveState>(INITIAL_SAVE);
  const controllerRef = useRef<AutosaveController | null>(null);
  const revisionRef = useRef(0);
  const documentRef = useRef<VisualisationIR | null>(null);
  const historyRef = useRef(new History<VisualisationIR>());
  const [canUndoRedo, setCanUndoRedo] = useState({ undo: false, redo: false });
  const syncHistory = useCallback(() => setCanUndoRedo({ undo: historyRef.current.canUndo, redo: historyRef.current.canRedo }), []);

  const adopt = useCallback((record: VisualisationRecord, bumpKey: boolean) => {
    revisionRef.current = record.revision;
    documentRef.current = record.document;
    setEditor((prev) => ({
      phase: "ready",
      projectId: record.projectId,
      document: record.document,
      loadKey: bumpKey ? (prev.phase === "ready" ? prev.loadKey + 1 : 1) : prev.phase === "ready" ? prev.loadKey : 1,
    }));
  }, []);

  // Load + wire autosave.
  useEffect(() => {
    if (!storage) return;
    let cancelled = false;
    const controller = new AutosaveController({
      save: (doc, { overwrite }) =>
        storage.visualisations.save(visualisationId, doc, { expectedRevision: revisionRef.current, overwrite }),
      onChange: setSave,
      onSaved: (record) => {
        revisionRef.current = record.revision;
      },
    });
    controllerRef.current = controller;
    historyRef.current = new History<VisualisationIR>();

    storage.visualisations.get(visualisationId).then(
      (record) => {
        if (cancelled) return;
        if (!record) {
          setEditor({ phase: "not-found" });
          return;
        }
        adopt(record, false);
        setSave({ status: "saved", lastSavedAt: record.document.updatedAt });
      },
      (error: unknown) => {
        if (!cancelled) setEditor({ phase: "error", message: error instanceof Error ? error.message : "Could not load." });
      },
    );

    const flushNow = () => void controller.flush();
    const onVisibility = () => document.visibilityState === "hidden" && flushNow();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (controller.hasUnsavedChanges) {
        flushNow();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushNow);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushNow);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void controller.flush().finally(() => controller.dispose());
      controllerRef.current = null;
    };
  }, [storage, visualisationId, adopt]);

  /** Apply an edit. Pure updater in, autosave scheduled, undo step recorded. */
  const update = useCallback(
    (updater: (doc: VisualisationIR) => VisualisationIR, options: UpdateOptions = {}) => {
      const current = documentRef.current;
      if (!current) return;
      const next = updater(current);
      if (next === current) return;
      if (options.history !== false) {
        historyRef.current.record(current, options.coalesceKey);
        syncHistory();
      }
      documentRef.current = next;
      setEditor((prev) => (prev.phase === "ready" ? { ...prev, document: next } : prev));
      controllerRef.current?.schedule(next);
    },
    [syncHistory],
  );

  const applyHistory = useCallback(
    (step: "undo" | "redo") => {
      const current = documentRef.current;
      if (!current) return;
      const snapshot = step === "undo" ? historyRef.current.undo(current) : historyRef.current.redo(current);
      syncHistory();
      if (!snapshot) return;
      // Where you are looking is not part of an edit: undo must not move the view.
      const target = { ...snapshot, viewport: current.viewport };
      documentRef.current = target;
      setEditor((prev) => (prev.phase === "ready" ? { ...prev, document: target } : prev));
      controllerRef.current?.schedule(target);
    },
    [syncHistory],
  );
  const undo = useCallback(() => applyHistory("undo"), [applyHistory]);
  const redo = useCallback(() => applyHistory("redo"), [applyHistory]);

  const keepMine = useCallback(() => void controllerRef.current?.resolveKeepMine(), []);

  const loadLatest = useCallback(() => {
    const stored = save.conflict;
    if (!stored) return;
    controllerRef.current?.resolveDiscardMine();
    historyRef.current.clear();
    syncHistory();
    adopt(stored, true);
    setSave({ status: "saved", lastSavedAt: stored.document.updatedAt });
  }, [save.conflict, adopt, syncHistory]);

  const retry = useCallback(() => void controllerRef.current?.retry(), []);
  const saveNow = useCallback(() => controllerRef.current?.flush() ?? Promise.resolve(), []);

  return { editor, save, update, undo, redo, canUndo: canUndoRedo.undo, canRedo: canUndoRedo.redo, keepMine, loadLatest, retry, saveNow };
}
