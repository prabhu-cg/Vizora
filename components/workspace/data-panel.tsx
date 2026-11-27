"use client";

import { Database, FileUp, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Spinner } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { useFeature } from "@/features/entitlements/client";
import { addDatasetToVisualisation, ingestFile, removeDataset } from "@/features/data-import";
import { errorMessage, notify } from "@/lib/notify";
import type { Dataset, VisualisationIR } from "@/types/visualisation";

export function DataPanel({
  document: doc,
  onChange,
}: {
  document: VisualisationIR;
  onChange: (updater: (d: VisualisationIR) => VisualisationIR) => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const canCsv = useFeature("data.import.csv");
  const canJson = useFeature("data.import.json");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Dataset>();

  const accept = [canCsv && ".csv,.tsv,text/csv", canJson && ".json,application/json"].filter(Boolean).join(",");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await ingestFile(file);
      onChange((d) => addDatasetToVisualisation(d, result));
      notify.success(`Imported ${result.dataset.rows.length.toLocaleString()} rows`, result.warnings[0]);
    } catch (error) {
      notify.error("Could not import that file", errorMessage(error));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section aria-labelledby={`${inputId}-h`} className="grid gap-4 p-4">
      <div>
        <h2 id={`${inputId}-h`} className="text-sm font-semibold">
          Data
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Files are read in your browser and never uploaded.</p>
      </div>

      {accept && (
        <div>
          <input
            ref={input}
            id={inputId}
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
            disabled={busy}
          />
          <Button variant="secondary" className="w-full" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Spinner /> : <FileUp aria-hidden="true" />} Import CSV or JSON
          </Button>
        </div>
      )}

      {doc.data.datasets.length === 0 ? (
        <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <Database className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          No datasets yet.
        </p>
      ) : (
        <ul className="grid gap-2">
          {doc.data.datasets.map((ds) => (
            <li key={ds.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{ds.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ds.rows.length.toLocaleString()} rows · {ds.columns.length} columns
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="-mr-2 -mt-1 size-9" aria-label={`Remove dataset ${ds.name}`} onClick={() => setRemoving(ds)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Columns in ${ds.name}`}>
                {ds.columns.slice(0, 8).map((c) => (
                  <li key={c.key} className="rounded bg-muted px-1.5 py-0.5 text-xs text-body">
                    {c.label} <span className="text-muted-foreground">· {c.type}</span>
                  </li>
                ))}
                {ds.columns.length > 8 && <li className="px-1 text-xs text-muted-foreground">+{ds.columns.length - 8} more</li>}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(undefined)}
        title={`Remove “${removing?.name ?? ""}”?`}
        description="The dataset is removed from this visualisation. You can import the file again later."
        confirmLabel="Remove dataset"
        onConfirm={async () => {
          if (removing) onChange((d) => removeDataset(d, removing.id));
        }}
      />
    </section>
  );
}
