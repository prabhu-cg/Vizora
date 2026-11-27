"use client";

import { ArrowLeft, Copy, Download, Redo2, Repeat2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Spinner } from "@/components/shared/loading-state";
import { SaveStatus } from "@/components/shared/save-status";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TYPE_META } from "@/components/visualisations/type-meta";
import { useEntitlements } from "@/features/entitlements/client";
import type { AutosaveState } from "@/features/visualisation/autosave";
import type { UpdateOptions } from "@/features/visualisation/use-visualisation-editor";
import { useRequiredStorage } from "@/hooks/use-storage";
import { ENGINE_TYPES, isEngineType, type EngineType } from "@/lib/engine";
import { downloadBlob } from "@/lib/export";
import { errorMessage, notify } from "@/lib/notify";
import { exportManager } from "@/services";
import type { VisualisationIR } from "@/types/visualisation";

export function WorkspaceHeader({
  document: doc,
  projectId,
  visualisationId,
  save,
  update,
  saveNow,
  onChangeType,
  history,
}: {
  document: VisualisationIR;
  projectId: string;
  visualisationId: string;
  save: AutosaveState;
  update: (updater: (d: VisualisationIR) => VisualisationIR, options?: UpdateOptions) => void;
  saveNow: () => Promise<void>;
  onChangeType: (target: EngineType) => void;
  /** Shown here only for types without the editing toolbar (charts). */
  history?: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
}) {
  const storage = useRequiredStorage();
  const router = useRouter();
  const entitlements = useEntitlements();
  const titleId = useId();
  const [draft, setDraft] = useState(doc.title);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exporters = exportManager.available(doc);

  const changeTitle = (value: string) => {
    setDraft(value);
    const trimmed = value.trim();
    if (trimmed) update((d) => (d.title === trimmed ? d : { ...d, title: trimmed }), { coalesceKey: "title" });
  };

  const duplicate = async () => {
    setBusy(true);
    try {
      await saveNow(); // never duplicate a stale copy
      const copy = await storage.visualisations.duplicate(visualisationId);
      notify.success("Duplicated", copy.document.title);
      router.push(`/app/workspace/${copy.id}`);
    } catch (error) {
      notify.error("Could not duplicate", errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const runExport = async (id: string) => {
    setExporting(true);
    try {
      const { filename, blob } = await exportManager.export(id, doc);
      downloadBlob(filename, blob);
      notify.success("Exported", filename);
    } catch (error) {
      notify.error("Export failed", errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface px-3 py-2 sm:px-4">
      <Button asChild variant="ghost" size="icon" aria-label="Back to project">
        <Link href={`/app/dashboard/${projectId}`}>
          <ArrowLeft aria-hidden="true" />
        </Link>
      </Button>

      <div className="min-w-0 flex-1 basis-48">
        <label htmlFor={titleId} className="sr-only">
          Visualisation title
        </label>
        <Input
          id={titleId}
          value={draft}
          onChange={(e) => changeTitle(e.target.value)}
          onBlur={() => !draft.trim() && setDraft(doc.title)}
          maxLength={200}
          aria-invalid={draft.trim() ? undefined : true}
          className="h-10 border-transparent bg-transparent text-base font-semibold hover:border-input focus-visible:bg-background"
        />
      </div>

      <SaveStatus state={save} />

      <div className="flex flex-wrap items-center gap-2">
        {history && (
          <>
            <Button variant="ghost" size="icon" className="size-9" aria-label="Undo" title="Undo (Ctrl/⌘ + Z)" disabled={!history.canUndo} onClick={history.undo}>
              <Undo2 aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" className="size-9" aria-label="Redo" title="Redo (Ctrl/⌘ + Shift + Z)" disabled={!history.canRedo} onClick={history.redo}>
              <Redo2 aria-hidden="true" />
            </Button>
          </>
        )}
        {isEngineType(doc.type) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Repeat2 aria-hidden="true" /> <span className="hidden sm:inline">Change type</span>
                <span className="sr-only sm:hidden">Change type</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {ENGINE_TYPES.map((t) => {
                const Icon = TYPE_META[t].icon;
                return (
                  <DropdownMenuItem key={t} disabled={t === doc.type} onSelect={() => onChangeType(t)}>
                    <Icon aria-hidden="true" /> {TYPE_META[t].label}
                    {t === doc.type && <span className="ml-auto text-xs text-muted-foreground">Current</span>}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {entitlements.can("projects.manage") && (
          <Button variant="outline" size="sm" onClick={duplicate} disabled={busy}>
            <Copy aria-hidden="true" /> <span className="hidden sm:inline">Duplicate</span>
            <span className="sr-only sm:hidden">Duplicate</span>
          </Button>
        )}
        {exporters.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                {exporting ? <Spinner /> : <Download aria-hidden="true" />} Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {exporters.map((e) => (
                <DropdownMenuItem key={e.id} onSelect={() => void runExport(e.id)}>
                  <span className="grid">
                    <span className="font-medium">{e.label}</span>
                    <span className="text-xs text-muted-foreground">{e.description}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
