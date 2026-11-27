"use client";

import { Download, HardDrive, ShieldAlert, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { ImportBackupButton } from "@/components/library/import-backup";
import { Spinner } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogBody, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRequiredStorage } from "@/hooks/use-storage";
import { describeBackup, downloadFullBackup } from "@/lib/library/backup-actions";
import { errorMessage, notify } from "@/lib/notify";
import type { StorageStats } from "@/types/data";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

type Browser = { usage?: number; quota?: number; persisted?: boolean } | "unsupported";

function loadBrowser(): Promise<Browser> {
  if (!navigator.storage?.estimate) return Promise.resolve("unsupported");
  return Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.()]).then(
    ([e, persisted]) => ({ usage: e.usage, quota: e.quota, persisted }),
    () => "unsupported" as const,
  );
}

/** The word a person must type before everything is deleted. */
export const CLEAR_CONFIRMATION = "DELETE";

export function StoragePanel() {
  const storage = useRequiredStorage();
  const [stats, setStats] = useState<StorageStats>();
  const [browser, setBrowser] = useState<Browser>();
  const [error, setError] = useState<string>();
  const [backingUp, setBackingUp] = useState(false);
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(() => {
    storage.data.stats().then(setStats, (e: unknown) => setError(errorMessage(e)));
    void loadBrowser().then(setBrowser);
  }, [storage]);

  useEffect(() => {
    // Load on open, and again whenever anything is saved, in this tab or another.
    refresh();
    return storage.subscribe(() => refresh());
  }, [storage, refresh]);

  const backup = async () => {
    setBackingUp(true);
    try {
      const b = await downloadFullBackup(storage);
      notify.success("Backup downloaded", describeBackup(b));
    } catch (e) {
      notify.error("Backup failed", errorMessage(e));
    } finally {
      setBackingUp(false);
    }
  };

  const persist = async () => {
    const granted = await navigator.storage.persist();
    notify[granted ? "success" : "info"](granted ? "Your browser will try to keep this data" : "The browser declined", granted ? undefined : "It may allow it later, once you use Vizora more.");
    void loadBrowser().then(setBrowser);
  };

  const empty = stats && stats.projects === 0 && stats.visualisations === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><HardDrive className="size-4" aria-hidden="true" /> Your data and storage</CardTitle>
        <CardDescription>Where your work lives, how much space it uses, and how to keep a copy.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p role="note" className="flex gap-2.5 rounded-input bg-warning-soft p-3 text-sm text-warning">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Your work is stored only in this browser, on this device.</strong> Vizora does not copy it to a server or to the cloud, so it is <strong>not backed up</strong>. Clearing this site&apos;s data in your browser, or losing the device, would remove it. Download a backup to keep a copy.
          </span>
        </p>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!stats && !error && <p className="text-sm text-muted-foreground"><Spinner className="mr-2" /> Measuring…</p>}

        {stats && (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Storage summary">
              {[
                ["Projects", stats.projects.toLocaleString()],
                ["Visualisations", stats.visualisations.toLocaleString()],
                ["Datasets", stats.datasets.toLocaleString()],
                ["Approximate size", formatBytes(stats.bytes)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-card border border-border bg-surface p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">Size is estimated from the saved records. Your browser may report a slightly different figure because it also counts its own overhead.</p>

            {stats.perProject.length > 0 && (
              <div className="overflow-auto rounded-card border border-border" tabIndex={0} role="region" aria-label="Space used by each project, scrollable">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">Space used by each project</caption>
                  <thead className="bg-surface text-left">
                    <tr>
                      <th scope="col" className="border-b border-border px-3 py-2 font-semibold">Project</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-right font-semibold">Visualisations</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-right font-semibold">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.perProject.slice(0, 8).map((p) => (
                      <tr key={p.id} className="odd:bg-card even:bg-surface/60">
                        <th scope="row" className="max-w-64 truncate px-3 py-1.5 text-left font-medium" title={p.name}>{p.name}</th>
                        <td className="px-3 py-1.5 text-right tabular-nums">{p.visualisations}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatBytes(p.bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {stats.perProject.length > 8 && <p className="text-xs text-muted-foreground">Showing the 8 largest of {stats.perProject.length} projects.</p>}
          </>
        )}

        {browser && browser !== "unsupported" && (
          <div className="grid gap-2 text-sm">
            <p>
              This site uses <strong>{formatBytes(browser.usage ?? 0)}</strong>
              {browser.quota ? <> of roughly {formatBytes(browser.quota)} your browser allows</> : null}.{" "}
              {browser.persisted ? <Badge variant="success">Kept by the browser</Badge> : <Badge variant="warning">Best effort</Badge>}
            </p>
            {!browser.persisted && (
              <div>
                <Button variant="outline" size="sm" onClick={() => void persist()}>Ask the browser to keep my data</Button>
                <p className="mt-1.5 text-xs text-muted-foreground">Browsers can clear a site&apos;s data when space runs low. This asks them not to; it is a request, not a guarantee.</p>
              </div>
            )}
          </div>
        )}
        {browser === "unsupported" && <p className="text-sm text-muted-foreground">This browser does not report how much space the site is using.</p>}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button onClick={backup} disabled={backingUp || empty}>
            {backingUp ? <Spinner /> : <Download aria-hidden="true" />} Download backup
          </Button>
          <ImportBackupButton>Import backup…</ImportBackupButton>
          <Button variant="destructive" className="ml-auto" disabled={empty} onClick={() => setClearing(true)}>
            <Trash2 aria-hidden="true" /> Clear local data…
          </Button>
        </div>
      </CardContent>
      <ClearDataDialog open={clearing} onOpenChange={setClearing} stats={stats} onBackup={backup} />
    </Card>
  );
}

/** Deleting everything needs more than a click: you must type a word, and a backup is offered first. */
function ClearDataDialog({ open, onOpenChange, stats, onBackup }: { open: boolean; onOpenChange: (o: boolean) => void; stats?: StorageStats; onBackup: () => void }) {
  const storage = useRequiredStorage();
  const id = useId();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = typed === CLEAR_CONFIRMATION;

  const run = async () => {
    setBusy(true);
    try {
      await storage.data.clearAll();
      notify.success("Local data cleared", "Everything stored by Vizora in this browser has been deleted.");
      onOpenChange(false);
    } catch (e) {
      notify.error("Could not clear the data", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!busy) { if (!o) setTyped(""); onOpenChange(o); } }}>
      <AlertDialogContent>
        <AlertDialogBody>
          <AlertDialogTitle>Delete all local data?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="grid gap-3">
              <p>
                This permanently deletes <strong>{stats?.projects ?? 0} project{stats?.projects === 1 ? "" : "s"}</strong> and <strong>{stats?.visualisations ?? 0} visualisation{stats?.visualisations === 1 ? "" : "s"}</strong> from this browser. Vizora keeps no other copy, so <strong>it cannot be recovered</strong> unless you have downloaded a backup.
              </p>
              <Button variant="link" size="sm" className="h-auto justify-self-start p-0" onClick={onBackup}>Download a backup first</Button>
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-t`}>Type {CLEAR_CONFIRMATION} to confirm</Label>
                <Input id={`${id}-t`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={!ok || busy} onClick={run}>
            {busy && <Spinner />} Delete everything
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
