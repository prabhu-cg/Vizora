"use client";

import { useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ChartCentre, ChartSettings } from "@/features/charts/chart-workspace";
import { DashboardCentre, WidgetSettings, useDashboard } from "@/features/dashboard/dashboard-workspace";
import { matchShortcut, shouldHandle } from "@/features/editor/shortcuts";
import type { UpdateOptions } from "@/features/visualisation/use-visualisation-editor";
import { cn } from "@/lib/utils/cn";
import type { VisualisationIR } from "@/types/visualisation";
import { DataPanel } from "./data-panel";
import { DetailsPanel } from "./details-panel";

type Update = (updater: (d: VisualisationIR) => VisualisationIR, options?: UpdateOptions) => void;
type PanelId = "canvas" | "data" | "settings";

/** The three-panel workspace for charts and dashboards. Loaded on demand so ECharts stays off other pages. */
export default function DataWorkspace({ doc, update, undo, redo, loadKey }: { doc: VisualisationIR; update: Update; undo: () => void; redo: () => void; loadKey: number }) {
  const dashboard = useDashboard(doc, update);
  const [panel, setPanel] = useState<PanelId>("canvas");
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

  const PANELS: { id: PanelId; label: string }[] = [{ id: "canvas", label: isDash ? "Dashboard" : "Chart" }, { id: "data", label: "Data" }, { id: "settings", label: "Settings" }];
  const details = <DetailsPanel key={loadKey} document={doc} onChange={update} />;

  return (
    <>
      <div role="group" aria-label="Workspace panels" className="flex border-b border-border bg-surface lg:hidden">
        {PANELS.map((p) => (
          <button key={p.id} type="button" aria-pressed={panel === p.id} onClick={() => setPanel(p.id)} className={cn("min-h-11 flex-1 border-b-2 px-3 text-sm font-medium", panel === p.id ? "border-primary text-primary-text" : "border-transparent text-muted-foreground")}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[18rem_minmax(0,1fr)_21rem]">
        <aside aria-label="Data" className={cn("min-h-0 overflow-y-auto border-r border-border bg-surface", panel === "data" ? "block" : "hidden", "lg:block")}>
          <DataPanel key={loadKey} document={doc} onChange={update} addOpen={adding} onAddOpenChange={setAdding} />
        </aside>
        <main id="main" tabIndex={-1} data-editor-canvas aria-label={isDash ? "Dashboard" : "Chart"} className={cn("min-h-0 min-w-0 bg-background outline-none", panel === "canvas" ? "block" : "hidden", "lg:block")}>
          <ErrorBoundary resetKey={`${loadKey}:${doc.type}`} title="This could not be drawn">
            {isDash ? <DashboardCentre doc={doc} state={dashboard} /> : <ChartCentre doc={doc} update={update} onAddData={() => setAdding(true)} />}
          </ErrorBoundary>
        </main>
        <aside aria-label="Settings" className={cn("min-h-0 overflow-y-auto border-l border-border bg-surface", panel === "settings" ? "block" : "hidden", "lg:block")}>
          {isDash ? (
            dashboard.selected ? <WidgetSettings doc={doc} state={dashboard} /> : (
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
          )}
        </aside>
      </div>
    </>
  );
}
