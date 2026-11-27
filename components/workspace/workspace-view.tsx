"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { Shapes } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { EngineCanvas } from "@/features/editor/canvas";
import { ConvertDialog } from "@/features/editor/convert-dialog";
import { EditorProvider } from "@/features/editor/context";
import { EditorShortcuts } from "@/features/editor/editor-shortcuts";
import { Inspector } from "@/features/editor/inspector";
import { ShortcutsDialog } from "@/features/editor/shortcuts-dialog";
import { SourcePanel } from "@/features/editor/source-panel";
import { EditorToolbar } from "@/features/editor/toolbar";
import { useEditorSession } from "@/features/editor/use-editor-session";
import { useVisualisationEditor } from "@/features/visualisation/use-visualisation-editor";
import { isEngineType, type EngineType } from "@/lib/engine";
import { cn } from "@/lib/utils/cn";
import type { VisualisationIR } from "@/types/visualisation";
import { ConflictBanner, SaveErrorBanner } from "./banners";
import { DetailsPanel } from "./details-panel";
import { WorkspaceHeader } from "./workspace-header";

const DataWorkspace = dynamic(() => import("./data-workspace"), { ssr: false, loading: () => <LoadingState label="Loading" rows={2} className="p-6" /> });

type PanelId = "canvas" | "side" | "inspector";
type Editor = ReturnType<typeof useVisualisationEditor>;

export function WorkspaceView({ visualisationId }: { visualisationId: string }) {
  const ed = useVisualisationEditor(visualisationId);
  const { editor } = ed;

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
          <Button asChild variant="outline">
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
  return <ReadyWorkspace ed={ed} visualisationId={visualisationId} projectId={editor.projectId} doc={editor.document} loadKey={editor.loadKey} />;
}

function ReadyWorkspace({ ed, visualisationId, projectId, doc, loadKey }: { ed: Editor; visualisationId: string; projectId: string; doc: VisualisationIR; loadKey: number }) {
  const { save, update, undo, redo, canUndo, canRedo, saveNow, keepMine, loadLatest, retry } = ed;
  const engine = isEngineType(doc.type);
  const session = useEditorSession(doc, update);
  const [panel, setPanel] = useState<PanelId>("canvas");
  const [helpOpen, setHelpOpen] = useState(false);
  const [convertTo, setConvertTo] = useState<EngineType>();

  const sideLabel = engine ? "Source" : "Data";
  const inspectorLabel = engine ? "Inspector" : "Details";
  const PANELS: { id: PanelId; label: string }[] = [
    { id: "canvas", label: "Canvas" },
    { id: "side", label: sideLabel },
    { id: "inspector", label: inspectorLabel },
  ];

  const details = <DetailsPanel key={loadKey} document={doc} onChange={update} />;

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh flex-col bg-background">
        <WorkspaceHeader
          key={loadKey}
          document={doc}
          projectId={projectId}
          visualisationId={visualisationId}
          save={save}
          update={update}
          saveNow={saveNow}
          onChangeType={setConvertTo}
          history={engine ? undefined : { undo, redo, canUndo, canRedo }}
        />

        {save.status === "conflict" && <ConflictBanner onKeepMine={keepMine} onLoadLatest={loadLatest} />}
        {save.status === "error" && <SaveErrorBanner message={save.error} onRetry={retry} />}

        {engine && <EditorToolbar doc={doc} session={session} update={update} undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} onHelp={() => setHelpOpen(true)} />}

        {!engine && <DataWorkspace doc={doc} update={update} undo={undo} redo={redo} loadKey={loadKey} />}

        {engine && (
          <>
          {/* Small screens: one panel at a time. lg+: three columns. */}
          <div role="group" aria-label="Workspace panels" className="flex border-b border-border bg-surface lg:hidden">
            {PANELS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={panel === p.id}
                onClick={() => setPanel(p.id)}
                className={cn("min-h-11 flex-1 border-b-2 px-3 text-sm font-medium", panel === p.id ? "border-primary text-primary-text" : "border-transparent text-muted-foreground")}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
            <aside aria-label={sideLabel} className={cn("min-h-0 overflow-y-auto border-r border-border bg-surface", panel === "side" ? "block" : "hidden", "lg:block")}>
              <SourcePanel key={loadKey} doc={doc} update={update} />
            </aside>

            <main id="main" tabIndex={-1} aria-label="Canvas" className={cn("min-h-0 min-w-0 bg-background outline-none", panel === "canvas" ? "block" : "hidden", "lg:block")}>
              <ErrorBoundary resetKey={`${loadKey}:${doc.type}`} title="This visualisation could not be drawn">
                <EditorProvider value={session.ctx}>
                  <EngineCanvas key={`${loadKey}:${doc.type}`} />
                </EditorProvider>
              </ErrorBoundary>
            </main>

            <aside aria-label={inspectorLabel} className={cn("min-h-0 overflow-y-auto border-l border-border bg-surface", panel === "inspector" ? "block" : "hidden", "lg:block")}>
              <Inspector doc={doc} session={session} update={update} fallback={details} />
            </aside>
          </div>

          </>
        )}

        {engine && (
          <>
            <EditorShortcuts doc={doc} session={session} undo={undo} redo={redo} onHelp={() => setHelpOpen(true)} />
            <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
            <ConvertDialog
              doc={doc}
              target={convertTo}
              onClose={() => setConvertTo(undefined)}
              onApply={(result) => {
                update(() => result);
                session.setSelection({ nodes: [], edges: [] });
              }}
            />
          </>
        )}
      </div>
    </ReactFlowProvider>
  );
}
