import { FileJson, FileSpreadsheet, FilePlus2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ChartVisual, FlowchartVisual } from "./illustrations";

const tile = "rounded-card border border-border bg-surface p-4";

/** Interface-style previews built from the app's own components. Illustrations, not captures. */
export function StepVisual({ step }: { step: 1 | 2 | 3 }) {
  if (step === 1) {
    return (
      <div className={tile} role="img" aria-label="Illustration: choose a CSV file, a JSON file or a blank canvas">
        <ul className="grid gap-2" aria-hidden="true">
          {[
            { icon: FileSpreadsheet, label: "sales-2026.csv", note: "12 rows · 3 columns" },
            { icon: FileJson, label: "build-times.json", note: "40 rows · 4 columns" },
            { icon: FilePlus2, label: "Blank canvas", note: "Start from nothing" },
          ].map(({ icon: Icon, label, note }) => (
            <li key={label} className="flex items-center gap-3 rounded-input border border-border bg-card px-3 py-2">
              <Icon className="size-5 text-primary-text" />
              <span className="grid text-left leading-tight">
                <span className="text-sm font-semibold text-foreground">{label}</span>
                <span className="text-xs text-muted-foreground">{note}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className={tile} role="img" aria-label="Illustration: choose between a diagram and a chart">
        <div className="grid grid-cols-2 gap-3" aria-hidden="true">
          <div className="rounded-card border border-primary bg-accent p-2">
            <FlowchartVisual className="h-auto w-full" />
            <p className="mt-1 text-center text-xs font-semibold text-accent-foreground">Diagram</p>
          </div>
          <div className="rounded-card border border-border bg-card p-2">
            <ChartVisual className="h-auto w-full" />
            <p className="mt-1 text-center text-xs font-semibold text-foreground">Chart</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={tile} role="img" aria-label="Illustration: a saved visualisation with an export menu">
      <div className="grid gap-3" aria-hidden="true">
        <div className="flex items-center justify-between rounded-input border border-border bg-card px-3 py-2">
          <span className="text-sm font-semibold text-foreground">Quarterly review</span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
            <span className="size-2 rounded-full bg-success" /> Saved
          </span>
        </div>
        <div className="rounded-input border border-border-strong bg-popover p-1">
          <p className="rounded-lg bg-muted px-2.5 py-1.5 text-sm text-foreground">Vizora JSON</p>
          <p className="flex items-center justify-between px-2.5 py-1.5 text-sm text-muted-foreground">
            PNG, SVG <Badge variant="outline">Planned</Badge>
          </p>
        </div>
      </div>
    </div>
  );
}
