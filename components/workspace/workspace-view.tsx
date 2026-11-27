"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { Minimize, Shapes } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { SaveStatus } from "@/components/shared/save-status";
import { Button } from "@/components/ui/button";
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
import type { VisualisationIR } from "@/types/visualisation";
import { ConflictBanner, SaveErrorBanner } from "./banners";
import { DetailsPanel } from "./details-panel";
import { useWorkspaceChrome, type Chrome } from "./use-workspace-chrome";
import { WorkspaceFrame } from "./workspace-frame";
import { WorkspaceHeader } from "./workspace-header";

const DataWorkspace = dynamic(() => import("./data-workspace"), { ssr: false, loading: () => <LoadingState label="Loading" rows={2} className="p-6" /> });

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

/** In full-screen mode only this stays: whether your work is saved, and a way back. */
function FocusBar({ chrome, save }: { chrome: Chrome; save: Editor["save"] }) {
  return (
    <div className="fixed right-3 top-3 z-40 flex items-center gap-2 rounded-full border border-border-strong bg-popover/95 px-3 py-1 shadow-overlay backdrop-blur">
      <SaveStatus state={save} />
      <Button size="sm" variant="outline" onClick={chrome.exitFocus} aria-label="Exit full-screen canvas">
        <Minimize aria-hidden="true" /> Exit
      </Button>
    </div>
  );
}

function ReadyWorkspace({ ed, visualisationId, projectId, doc, loadKey }: { ed: Editor; visualisationId: string; projectId: string; doc: VisualisationIR; loadKey: number }) {
  const { save, update, undo, redo, canUndo, canRedo, saveNow, keepMine, loadLatest, retry } = ed;
  const engine = isEngineType(doc.type);
  const session = useEditorSession(doc, update);
  const chrome = useWorkspaceChrome();
  const [helpOpen, setHelpOpen] = useState(false);
  const [convertTo, setConvertTo] = useState<EngineType>();

  const details = <DetailsPanel key={loadKey} document={doc} onChange={update} />;

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh flex-col bg-background">
        {!chrome.focus && (
          <WorkspaceHeader key={loadKey} document={doc} projectId={projectId} visualisationId={visualisationId} save={save} update={update} saveNow={saveNow} onChangeType={setConvertTo} />
        )}
        {chrome.focus && <FocusBar chrome={chrome} save={save} />}

        {/* Problems with saving are never hidden, even in full screen. */}
        {save.status === "conflict" && <ConflictBanner onKeepMine={keepMine} onLoadLatest={loadLatest} />}
        {save.status === "error" && <SaveErrorBanner message={save.error} onRetry={retry} />}

        {engine ? (
          <>
            {!chrome.focus && <EditorToolbar doc={doc} session={session} update={update} undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} onHelp={() => setHelpOpen(true)} chrome={chrome} />}
            <WorkspaceFrame
              chrome={chrome}
              centreLabel="Canvas"
              left={{ label: "Source", tab: "Source", node: <SourcePanel key={loadKey} doc={doc} update={update} /> }}
              right={{ label: "Inspector", tab: "Inspector", node: <Inspector doc={doc} session={session} update={update} fallback={details} /> }}
              centre={
                <main id="main" tabIndex={-1} aria-label="Canvas" className="h-full min-h-0 min-w-0 bg-background outline-none">
                  <ErrorBoundary resetKey={`${loadKey}:${doc.type}`} title="This visualisation could not be drawn">
                    <EditorProvider value={session.ctx}>
                      <EngineCanvas key={`${loadKey}:${doc.type}`} />
                    </EditorProvider>
                  </ErrorBoundary>
                </main>
              }
            />
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
        ) : (
          <DataWorkspace doc={doc} update={update} undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} loadKey={loadKey} chrome={chrome} />
        )}
      </div>
    </ReactFlowProvider>
  );
}
