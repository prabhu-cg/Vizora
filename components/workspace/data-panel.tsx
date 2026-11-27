"use client";

import { Database, Download, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataInspector } from "@/features/data/data-inspector";
import { ImportDataDrawer } from "@/features/data/import-drawer";
import { ManualGrid } from "@/features/data/manual-grid";
import { useFeature } from "@/features/entitlements/client";
import type { UpdateOptions } from "@/features/visualisation/use-visualisation-editor";
import { addDataset, datasetFromGrid, gridFromDataset, removeDataset, replaceDataset, type SourceInfo } from "@/lib/data";
import { downloadBlob, datasetToCsv, slugify } from "@/lib/export";
import { notify } from "@/lib/notify";
import type { Dataset, VisualisationIR } from "@/types/visualisation";

type Update = (updater: (d: VisualisationIR) => VisualisationIR, options?: UpdateOptions) => void;
const ORIGIN = { import: "Imported", paste: "Pasted", manual: "Typed in" } as const;
const EDITABLE_LIMIT = { rows: 500, columns: 30 };

/** The datasets in a chart or dashboard: add, look at, download, edit (typed-in data only) and remove. */
export function DataPanel({ document: doc, onChange, addOpen, onAddOpenChange }: { document: VisualisationIR; onChange: Update; addOpen?: boolean; onAddOpenChange?: (o: boolean) => void }) {
  const id = useId();
  const canImport = useFeature("data.import.csv");
  const [localAdding, setLocalAdding] = useState(false);
  const adding = addOpen ?? localAdding;
  const setAdding = onAddOpenChange ?? setLocalAdding;
  const [inspecting, setInspecting] = useState<Dataset>();
  const [editing, setEditing] = useState<Dataset>();
  const [removing, setRemoving] = useState<Dataset>();

  const add = (dataset: Dataset, source?: SourceInfo) => {
    onChange((d) => addDataset(d, dataset, source));
    notify.success(`Added “${dataset.name}”`, `${dataset.rows.length.toLocaleString()} rows, ${dataset.columns.length} columns`);
  };
  const download = (ds: Dataset) => {
    downloadBlob(`${slugify(ds.name, "dataset")}.csv`, new Blob(["﻿" + datasetToCsv(ds)], { type: "text/csv;charset=utf-8" }));
  };

  return (
    <section aria-labelledby={`${id}-h`} className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4">
      <div>
        <h3 id={`${id}-h`} className="text-[15px] font-semibold">Data</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Read in your browser and never uploaded. Your original files are never changed.</p>
      </div>

      {canImport && (
        <Button variant={doc.data.datasets.length ? "outline" : "primary"} className="w-full" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" /> Add data
        </Button>
      )}

      {doc.data.datasets.length === 0 ? (
        <p className="flex items-start gap-2 rounded-input bg-muted p-3 text-sm text-muted-foreground">
          <Database className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          No data yet. Upload a CSV, JSON or Excel file, paste from a spreadsheet, or type it in.
        </p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {doc.data.datasets.map((ds) => {
            const editable = ds.origin === "manual" && ds.rows.length <= EDITABLE_LIMIT.rows && ds.columns.length <= EDITABLE_LIMIT.columns;
            return (
              <li key={ds.id} className="min-w-0 rounded-input border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={ds.name}>{ds.name}</p>
                    <p className="text-xs text-muted-foreground">{ds.rows.length.toLocaleString()} rows · {ds.columns.length} columns</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{ORIGIN[ds.origin ?? "import"]}</Badge>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Columns in ${ds.name}`}>
                  {ds.columns.slice(0, 8).map((c) => (
                    <li key={c.key} className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-xs text-body" title={`${c.label} (${c.type})`}>{c.label} <span className="text-muted-foreground">· {c.type}</span></li>
                  ))}
                  {ds.columns.length > 8 && <li className="px-1 text-xs text-muted-foreground">+{ds.columns.length - 8} more</li>}
                </ul>
                <div className="-mx-1 mt-2 flex flex-wrap gap-0.5">
                  <Button variant="ghost" size="sm" onClick={() => setInspecting(ds)} aria-label={`Inspect ${ds.name}`}><Eye aria-hidden="true" /> Inspect</Button>
                  {editable && <Button variant="ghost" size="sm" onClick={() => setEditing(ds)} aria-label={`Edit ${ds.name}`}><Pencil aria-hidden="true" /> Edit</Button>}
                  <Button variant="ghost" size="sm" onClick={() => download(ds)} aria-label={`Download ${ds.name} as CSV`}><Download aria-hidden="true" /> CSV</Button>
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(ds)} aria-label={`Remove ${ds.name}`}><Trash2 aria-hidden="true" /> Remove</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {doc.source.sha256 && doc.source.name && (
        <p className="text-xs text-muted-foreground">
          Last file: <strong className="font-medium text-body">{doc.source.name}</strong>, checksum <code className="font-mono">{doc.source.sha256.slice(0, 12)}…</code> (SHA-256 of the original, so you can confirm it was not changed).
        </p>
      )}

      <ImportDataDrawer open={adding} onOpenChange={setAdding} onAdd={add} />
      <DataInspector dataset={inspecting} open={Boolean(inspecting)} onOpenChange={(o) => !o && setInspecting(undefined)} />
      <EditDatasetDrawer key={editing?.id ?? "none"} dataset={editing} onClose={() => setEditing(undefined)} onSave={(d) => { onChange((doc) => replaceDataset(doc, d)); notify.success("Data updated"); }} />
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(undefined)}
        title={`Remove “${removing?.name ?? ""}”?`}
        description="The dataset is removed from this visualisation, and charts that used it will need another dataset. Your original file is untouched, so you can add it again."
        confirmLabel="Remove dataset"
        onConfirm={async () => { if (removing) onChange((d) => removeDataset(d, removing.id)); }}
      />
    </section>
  );
}

function EditDatasetDrawer({ dataset, onClose, onSave }: { dataset?: Dataset; onClose: () => void; onSave: (d: Dataset) => void }) {
  const id = useId();
  const [grid, setGrid] = useState(() => (dataset ? gridFromDataset(dataset) : { headers: [], rows: [] }));
  const [name, setName] = useState(dataset?.name ?? "");
  return (
    <Drawer open={Boolean(dataset)} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent size="lg">
        <DrawerHeader title="Edit data" description="Types are re-detected when you save. Charts using this dataset update." />
        <DrawerBody className="grid content-start gap-5">
          <div className="grid max-w-sm gap-1.5">
            <Label htmlFor={`${id}-n`}>Dataset name</Label>
            <Input id={`${id}-n`} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>
          <ManualGrid grid={grid} onChange={setGrid} />
        </DrawerBody>
        <DrawerFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (dataset) onSave(datasetFromGrid(grid, { id: dataset.id, name: name || dataset.name, origin: "manual" })); onClose(); }}>Save changes</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
