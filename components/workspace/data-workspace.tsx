"use client";

import { Plus, Redo2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ChartCentre, ChartSettings } from "@/features/charts/chart-workspace";
import { DashboardCentre, WidgetSettings, useDashboard } from "@/features/dashboard/dashboard-workspace";
import { matchShortcut, shouldHandle } from "@/features/editor/shortcuts";
import type { UpdateOptions } from "@/features/visualisation/use-visualisation-editor";
import { Button } from "@/components/ui/button";
import type { VisualisationIR } from "@/types/visualisation";
import { DataPanel } from "./data-panel";
import { DetailsPanel } from "./details-panel";
import type { Chrome } from "./use-workspace-chrome";
import { PanelControls, WorkspaceFrame } from "./workspace-frame";

type Update = (updater: (d: VisualisationIR) => VisualisationIR, options?: UpdateOptions) => void;
/** Contextual toolbar for charts and dashboards: history, adding data, and the panel and full-screen controls. */
function DataToolbar({ doc, undo, redo, canUndo, canRedo, onAddData, chrome }: { doc: VisualisationIR; undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean; onAddData: () => void; chrome: Chrome }) {
  return (
    <div role="toolbar" aria-label="Editing tools" className="flex flex-wrap items-center gap-1 border-b border-border bg-surface px-3 py-1.5">
      <div role="group" aria-label="History" className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-9" aria-label="Undo (Ctrl/⌘ + Z)" title="Undo (Ctrl/⌘ + Z)" disabled={!canUndo} onClick={undo}><Undo2 aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" className="size-9" aria-label="Redo (Ctrl/⌘ + Shift + Z)" title="Redo (Ctrl/⌘ + Shift + Z)" disabled={!canRedo} onClick={redo}><Redo2 aria-hidden="true" /></Button>
      </div>
      <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-border sm:block" />
      <Button variant="outline" size="sm" onClick={onAddData}><Plus aria-hidden="true" /> Add data</Button>
      <p className="ml-2 hidden text-xs text-muted-foreground md:block">{doc.data.datasets.length} dataset{doc.data.datasets.length === 1 ? "" : "s"}</p>
      <div role="group" aria-label="View" className="ml-auto flex items-center gap-1">
        <PanelControls chrome={chrome} left="Data" right="Settings" />
      </div>
    </div>
  );
}

/** The workspace for charts and dashboards. Loaded on demand so ECharts stays off other pages. */
export default function DataWorkspace({ doc, update, undo, redo, canUndo, canRedo, loadKey, chrome }: { doc: VisualisationIR; update: Update; undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean; loadKey: number; chrome: Chrome }) {
  const dashboard = useDashboard(doc, update);
  const [adding, setAdding] = useState(false);
  const isDash = doc.type === "dashboard";

  // Undo and redo from the keyboard, when focus is on the workspace and not in a field or dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = matchShortcut(e);
      if ((action === "undo" || action === "redo") && shouldHandle(action, e.target, document)) {
        e.preventDefault();
        (action === "undo" ? undo : redo)();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const details = <DetailsPanel key={loadKey} document={doc} onChange={update} />;
  const kind = isDash ? "Dashboard" : "Chart";

  return (
    <>
      {!chrome.focus && <DataToolbar doc={doc} undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} onAddData={() => setAdding(true)} chrome={chrome} />}
      <WorkspaceFrame
        chrome={chrome}
        centreLabel={kind}
        left={{ label: "Data", tab: "Data", node: <DataPanel key={loadKey} document={doc} onChange={update} addOpen={adding} onAddOpenChange={setAdding} /> }}
        right={{
          label: "Settings",
          tab: "Settings",
          node: isDash ? (
            dashboard.selected ? (
              <WidgetSettings doc={doc} state={dashboard} />
            ) : (
              <>
                <p className="border-b border-border p-4 text-sm text-muted-foreground">Select a chart on the dashboard to change its type, data and appearance.</p>
                {details}
              </>
            )
          ) : (
            <>
              <ChartSettings doc={doc} update={update} />
              <details className="border-t border-border">
                <summary className="flex min-h-11 cursor-pointer items-center px-4 text-[15px] font-semibold">About this chart</summary>
                {details}
              </details>
            </>
          ),
        }}
        centre={
          <main id="main" tabIndex={-1} data-editor-canvas aria-label={kind} className="h-full min-h-0 min-w-0 overflow-auto bg-background outline-none">
            <ErrorBoundary resetKey={`${loadKey}:${doc.type}`} title="This could not be drawn">
              {isDash ? <DashboardCentre doc={doc} state={dashboard} /> : <ChartCentre doc={doc} update={update} onAddData={() => setAdding(true)} />}
            </ErrorBoundary>
          </main>
        }
      />
    </>
  );
}
