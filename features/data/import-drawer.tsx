"use client";

import { FileUp } from "lucide-react";
import { useDeferredValue, useId, useMemo, useRef, useState } from "react";
import { Spinner } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@/components/ui/drawer";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEntitlements } from "@/features/entitlements/client";
import {
  ACCEPT_ATTRIBUTE, IngestError, buildDataset, datasetFromGrid, emptyGrid, readFile, readText, sheetToTable,
  type ColumnType, type FileRead, type IngestPreview, type RawTable, type SourceInfo,
} from "@/lib/data";
import { errorMessage } from "@/lib/notify";
import { cn } from "@/lib/utils/cn";
import type { Dataset } from "@/types/visualisation";
import { DataPreview, toNotes } from "./data-preview";
import { ManualGrid } from "./manual-grid";
import { WarningList } from "@/features/editor/source-panel";
import { profileDataset } from "@/lib/data";

type Mode = "file" | "paste" | "manual";

export function ImportDataDrawer({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (dataset: Dataset, source?: SourceInfo) => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent size="lg">
        <Body onCancel={() => onOpenChange(false)} onAdd={(d, s) => { onAdd(d, s); onOpenChange(false); }} />
      </DrawerContent>
    </Drawer>
  );
}

function Body({ onAdd, onCancel }: { onAdd: (d: Dataset, s?: SourceInfo) => void; onCancel: () => void }) {
  const id = useId();
  const entitlements = useEntitlements();
  const modes = ([["file", "Upload a file", true], ["paste", "Paste data", entitlements.can("data.import.paste")], ["manual", "Type it in", entitlements.can("data.manual")]] as const).filter((m) => m[2]);
  const [mode, setMode] = useState<Mode>("file");
  const [read, setRead] = useState<FileRead>();
  const [sheet, setSheet] = useState<string>();
  const [fileError, setFileError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [header, setHeader] = useState<"auto" | boolean>("auto");
  const [dedupe, setDedupe] = useState(false);
  const [types, setTypes] = useState<Record<number, ColumnType>>({});
  const [name, setName] = useState("");
  const [grid, setGrid] = useState(() => emptyGrid(3, 6));
  const input = useRef<HTMLInputElement>(null);
  const deferredText = useDeferredValue(text);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setFileError(undefined);
    try {
      const r = await readFile(file);
      setRead(r);
      setSheet(r.raw.sheet);
      setTypes({});
      setName((r.source.name ?? "Dataset").replace(/\.[^.]+$/, ""));
    } catch (e) {
      setRead(undefined);
      setFileError(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  // Everything below is derived, so the preview always matches the options on screen.
  const raw: { table?: RawTable; error?: string } = useMemo(() => {
    try {
      if (mode === "file") return read ? { table: read.workbook ? sheetToTable(read.workbook, sheet) : read.raw } : { error: fileError };
      if (mode === "paste") return deferredText.trim() ? { table: readText(deferredText, { paste: true }) } : {};
    } catch (e) {
      return { error: errorMessage(e) };
    }
    return {};
  }, [mode, read, sheet, fileError, deferredText]);

  const built: { preview?: IngestPreview; error?: string } = useMemo(() => {
    if (!raw.table) return { error: raw.error };
    try {
      return { preview: buildDataset(raw.table, { header, types, removeDuplicates: dedupe, name: name || (mode === "paste" ? "Pasted data" : "Dataset") }) };
    } catch (e) {
      return { error: e instanceof IngestError ? e.message : errorMessage(e) };
    }
  }, [raw, header, types, dedupe, name, mode]);

  const manual = useMemo(() => (mode === "manual" ? datasetFromGrid(grid, { name: name || "Manual data" }) : undefined), [mode, grid, name]);
  const manualProfile = useMemo(() => (manual ? profileDataset(manual) : undefined), [manual]);

  const canAdd = mode === "manual" ? Boolean(manual && manual.rows.length > 0) : Boolean(built.preview);
  const submit = () => {
    if (mode === "manual" && manual) return onAdd(manual);
    if (built.preview) onAdd(built.preview.dataset, mode === "file" ? read?.source : { format: "paste", size: text.length, name: "Pasted data" });
  };
  const hasDupes = (built.preview?.profile.duplicateRows ?? 0) > 0 || (built.preview?.duplicatesRemoved ?? 0) > 0;
  const sheets = raw.table?.sheets;

  return (
    <>
      <DrawerHeader title="Add data" description="Files are read in your browser and never uploaded. The original file is never changed." />
      <DrawerBody className="grid content-start gap-6">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium text-foreground">Source</legend>
          <div className="flex flex-wrap gap-2">
            {modes.map(([value, label]) => (
              <label key={value} className={cn("inline-flex min-h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring", mode === value ? "border-primary bg-accent font-semibold text-accent-foreground" : "border-border-strong bg-background hover:bg-muted")}>
                <input type="radio" name={`${id}-mode`} className="sr-only" checked={mode === value} onChange={() => setMode(value)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {mode === "file" && (
          <div className="grid gap-2">
            <input ref={input} id={`${id}-file`} type="file" accept={ACCEPT_ATTRIBUTE} className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} disabled={busy} />
            <div>
              <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
                {busy ? <Spinner /> : <FileUp aria-hidden="true" />} {read ? "Choose a different file" : "Choose a file"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">CSV, TSV, JSON or Excel (.xlsx), up to 25 MB.</p>
            {read && <p className="text-sm text-body" role="status">Read <strong>{read.source.name}</strong> ({(read.source.size / 1024).toFixed(read.source.size > 10240 ? 0 : 1)} KB){read.source.sha256 ? <> · checksum <code className="font-mono text-xs">{read.source.sha256.slice(0, 12)}…</code></> : null}</p>}
            {fileError && <p role="alert" className="rounded-input bg-destructive-soft p-3 text-sm text-destructive">{fileError}</p>}
          </div>
        )}

        {mode === "paste" && (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-paste`}>Paste your data</Label>
            <Textarea id={`${id}-paste`} rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Copy cells from a spreadsheet and paste them here, or paste CSV, JSON or a table.\n\nMonth\tRevenue\nJan\t120\nFeb\t150"} className="font-mono text-[13px]" autoFocus />
          </div>
        )}

        {mode === "manual" && <ManualGrid grid={grid} onChange={setGrid} />}

        {mode !== "manual" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-name`}>Dataset name</Label>
              <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
            </div>
            {sheets && sheets.length > 1 && (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-sheet`}>Sheet</Label>
                <Select id={`${id}-sheet`} value={sheet} onChange={(e) => { setSheet(e.target.value); setTypes({}); }}>
                  {sheets.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-header`}>First row</Label>
              <Select id={`${id}-header`} value={String(header)} onChange={(e) => setHeader(e.target.value === "auto" ? "auto" : e.target.value === "true")}>
                <option value="auto">Detect automatically</option>
                <option value="true">Contains column names</option>
                <option value="false">Is data (no header)</option>
              </Select>
            </div>
            {hasDupes && (
              <label className="flex min-h-10 cursor-pointer items-center gap-2.5 self-end text-sm">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
                Remove duplicate rows from this copy
              </label>
            )}
          </div>
        )}
        {mode === "manual" && (
          <div className="grid gap-1.5 sm:max-w-sm">
            <Label htmlFor={`${id}-mname`}>Dataset name</Label>
            <Input id={`${id}-mname`} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder="Manual data" />
          </div>
        )}

        {mode !== "manual" && built.error && !(mode === "file" && fileError) && <p role="alert" className="rounded-input bg-destructive-soft p-3 text-sm text-destructive">{built.error}</p>}
        {mode !== "manual" && built.preview && <DataPreview preview={built.preview} onType={(i, t) => setTypes((p) => ({ ...p, [i]: t }))} />}
        {mode === "manual" && manual && manualProfile && (
          <p className="text-sm text-body" aria-live="polite">
            {manual.rows.length === 0 ? "Type some values above. Empty rows are ignored." : <>This will add <strong>{manual.rows.length}</strong> row{manual.rows.length === 1 ? "" : "s"} and <strong>{manual.columns.length}</strong> column{manual.columns.length === 1 ? "" : "s"}. Detected: {manual.columns.map((c) => `${c.label} (${c.type})`).join(", ")}.</>}
          </p>
        )}
        {mode === "manual" && manualProfile && manualProfile.duplicateRows > 0 && <WarningList warnings={toNotes([{ code: "duplicates", message: `${manualProfile.duplicateRows} row${manualProfile.duplicateRows === 1 ? " is a duplicate" : "s are duplicates"} of earlier rows.` }])} />}
      </DrawerBody>
      <DrawerFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={submit} disabled={!canAdd}>Add dataset</Button>
      </DrawerFooter>
    </>
  );
}
