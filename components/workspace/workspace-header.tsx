"use client";

import { ArrowLeft, Copy, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { SaveStatus } from "@/components/shared/save-status";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useEntitlements } from "@/features/entitlements/client";
import type { AutosaveState } from "@/features/visualisation/autosave";
import { useRequiredStorage } from "@/hooks/use-storage";
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
}: {
  document: VisualisationIR;
  projectId: string;
  visualisationId: string;
  save: AutosaveState;
  update: (updater: (d: VisualisationIR) => VisualisationIR) => void;
  saveNow: () => Promise<void>;
}) {
  const storage = useRequiredStorage();
  const router = useRouter();
  const entitlements = useEntitlements();
  const titleId = useId();
  const [draft, setDraft] = useState(doc.title);
  const [busy, setBusy] = useState(false);
  const exporters = exportManager.available();

  const changeTitle = (value: string) => {
    setDraft(value);
    const trimmed = value.trim();
    if (trimmed) update((d) => (d.title === trimmed ? d : { ...d, title: trimmed }));
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

  const runExport = (id: string) => {
    try {
      const { filename, blob } = exportManager.export(id, doc);
      downloadBlob(filename, blob);
      notify.success("Exported", filename);
    } catch (error) {
      notify.error("Export failed", errorMessage(error));
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

      <div className="flex items-center gap-2">
        {entitlements.can("projects.manage") && (
          <Button variant="secondary" size="sm" onClick={duplicate} disabled={busy}>
            <Copy aria-hidden="true" /> <span className="hidden sm:inline">Duplicate</span>
            <span className="sr-only sm:hidden">Duplicate</span>
          </Button>
        )}
        {exporters.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <Download aria-hidden="true" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {exporters.map((e) => (
                <DropdownMenuItem key={e.id} onSelect={() => runExport(e.id)}>
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
