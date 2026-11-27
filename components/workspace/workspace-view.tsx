"use client";

import { Shapes } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { hasRenderer, VisualisationRenderer } from "@/components/visualisations/registry";
import { useVisualisationEditor } from "@/features/visualisation/use-visualisation-editor";
import { cn } from "@/lib/utils/cn";
import { ConflictBanner, SaveErrorBanner } from "./banners";
import { DataPanel } from "./data-panel";
import { DetailsPanel } from "./details-panel";
import { WorkspaceHeader } from "./workspace-header";

type PanelId = "canvas" | "data" | "details";
const PANELS: { id: PanelId; label: string }[] = [
  { id: "canvas", label: "Canvas" },
  { id: "data", label: "Data" },
  { id: "details", label: "Details" },
];

export function WorkspaceView({ visualisationId }: { visualisationId: string }) {
  const { editor, save, update, keepMine, loadLatest, retry, saveNow } = useVisualisationEditor(visualisationId);
  const [panel, setPanel] = useState<PanelId>("canvas");

  if (editor.phase === "loading") {
    return (
      <div className="p-6">
        <LoadingState label="Opening visualisation" rows={2} />
      </div>
    );
  }
  if (editor.phase === "error") {
    return (
      <div className="p-6">
        <ErrorState title="Could not open this visualisation" message={editor.message} onRetry={() => location.reload()}>
          <Button asChild variant="secondary">
            <Link href="/app/dashboard">Back to dashboard</Link>
          </Button>
        </ErrorState>
      </div>
    );
  }
  if (editor.phase === "not-found") {
    return (
      <div className="p-6">
        <EmptyState
          icon={Shapes}
          title="Visualisation not found"
          description="It may have been deleted, or it lives in a different browser."
          action={
            <Button asChild>
              <Link href="/app/dashboard">Back to dashboard</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { document: doc, projectId, loadKey } = editor;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <WorkspaceHeader
        key={loadKey}
        document={doc}
        projectId={projectId}
        visualisationId={visualisationId}
        save={save}
        update={update}
        saveNow={saveNow}
      />

      {save.status === "conflict" && <ConflictBanner onKeepMine={keepMine} onLoadLatest={loadLatest} />}
      {save.status === "error" && <SaveErrorBanner message={save.error} onRetry={retry} />}

      {/* Small screens: one panel at a time. lg+: three columns. */}
      <div role="group" aria-label="Workspace panels" className="flex border-b border-border bg-surface lg:hidden">
        {PANELS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={panel === p.id}
            onClick={() => setPanel(p.id)}
            className={cn(
              "min-h-11 flex-1 border-b-2 px-3 text-sm font-medium",
              panel === p.id ? "border-primary text-primary" : "border-transparent text-muted-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[17rem_minmax(0,1fr)_18rem]">
        <aside
          aria-label="Data"
          className={cn("min-h-0 overflow-y-auto border-r border-border bg-surface", panel === "data" ? "block" : "hidden", "lg:block")}
        >
          <DataPanel key={loadKey} document={doc} onChange={update} />
        </aside>

        <main
          id="main"
          tabIndex={-1}
          aria-label="Canvas"
          className={cn("min-h-0 min-w-0 bg-surface outline-none", panel === "canvas" ? "block" : "hidden", "lg:block")}
        >
          <ErrorBoundary resetKey={loadKey} title="This visualisation could not be drawn">
            {hasRenderer(doc.type) ? (
              <VisualisationRenderer key={loadKey} type={doc.type} document={doc} onChange={update} />
            ) : (
              <div className="grid h-full place-items-center p-6">
                <EmptyState
                  icon={Shapes}
                  title="No renderer for this type yet"
                  description="Your data is safe and saved. A renderer for this type arrives in a later release."
                />
              </div>
            )}
          </ErrorBoundary>
        </main>

        <aside
          aria-label="Details"
          className={cn("min-h-0 overflow-y-auto border-l border-border bg-surface", panel === "details" ? "block" : "hidden", "lg:block")}
        >
          <DetailsPanel key={loadKey} document={doc} onChange={update} />
        </aside>
      </div>
    </div>
  );
}
