"use client";

import { Check, Download, HardDrive, Minus, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Spinner } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FEATURE_CATALOGUE, PLAN_LABELS, useEntitlements } from "@/features/entitlements/client";
import { useRequiredStorage } from "@/hooks/use-storage";
import { backupFilename, parseBackupText, serializeBackup } from "@/lib/storage";
import { downloadBlob } from "@/lib/export";
import { errorMessage, notify } from "@/lib/notify";
import { CURRENT_BACKUP_VERSION, CURRENT_PROJECT_SCHEMA_VERSION, CURRENT_VISUALISATION_SCHEMA_VERSION } from "@/lib/validation";
import type { BackupPreview, ConflictPolicy } from "@/types/data";

export function SettingsView() {
  return (
    <>
      <PageHeader title="Settings" description="Plan, backups and local storage." />
      <div className="grid gap-6">
        <PlanSection />
        <BackupSection />
        <StorageSection />
        <AboutSection />
      </div>
    </>
  );
}

function PlanSection() {
  const entitlements = useEntitlements();
  const plan = entitlements.plan();
  const features = entitlements.featuresFor();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Plan <Badge variant="blue">{PLAN_LABELS[plan]}</Badge>
        </CardTitle>
        <CardDescription>
          Every feature in the {PLAN_LABELS[plan]} edition is enabled. There is no account, billing or cloud service in this edition.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {features.map((f) => {
            const planned = !FEATURE_CATALOGUE[f.id].released;
            return (
              <li key={f.id} className="flex items-center gap-2">
                {f.allowed ? (
                  <Check className="size-4 text-success" aria-hidden="true" />
                ) : (
                  <Minus className="size-4 text-muted-foreground" aria-hidden="true" />
                )}
                <span className={f.allowed ? undefined : "text-muted-foreground"}>
                  {f.label}
                  {f.allowed && <span className="sr-only"> (enabled)</span>}
                  {planned && " — planned"}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function BackupSection() {
  const storage = useRequiredStorage();
  const entitlements = useEntitlements();
  const fileInput = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [pending, setPending] = useState<{ raw: unknown; preview: BackupPreview; name: string }>();
  const enabled = entitlements.can("backup.local");

  const exportBackup = async () => {
    setExporting(true);
    try {
      const backup = await storage.backup.export();
      downloadBlob(backupFilename(), new Blob([serializeBackup(backup)], { type: "application/json" }));
      notify.success(
        "Backup downloaded",
        `${backup.projects.length} project${backup.projects.length === 1 ? "" : "s"}, ${backup.visualisations.length} visualisation${backup.visualisations.length === 1 ? "" : "s"}`,
      );
    } catch (error) {
      notify.error("Backup failed", errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const raw = parseBackupText(await file.text());
      const preview = await storage.backup.preview(raw);
      setPending({ raw, preview, name: file.name });
    } catch (error) {
      notify.error("Cannot import that file", errorMessage(error));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup &amp; restore</CardTitle>
        <CardDescription>
          Your data lives only in this browser. Download a backup to move it to another device or protect it against cleared site data.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button onClick={exportBackup} disabled={!enabled || exporting}>
          {exporting ? <Spinner /> : <Download aria-hidden="true" />} Download backup
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          aria-label="Choose a VIZORA backup file"
          tabIndex={-1}
          onChange={(e) => void chooseFile(e.target.files?.[0])}
        />
        <Button variant="secondary" disabled={!enabled} onClick={() => fileInput.current?.click()}>
          <Upload aria-hidden="true" /> Import backup…
        </Button>
      </CardContent>
      <ImportDialog
        pending={pending}
        onClose={() => setPending(undefined)}
        onImport={async (policy) => {
          if (!pending) return;
          const report = await storage.backup.import(pending.raw, policy);
          notify.success(
            "Backup imported",
            `${report.projectsAdded} project(s) and ${report.visualisationsAdded} visualisation(s) added; ${report.projectsSkipped + report.visualisationsSkipped} skipped.`,
          );
        }}
      />
    </Card>
  );
}

function ImportDialog({
  pending,
  onClose,
  onImport,
}: {
  pending?: { preview: BackupPreview; name: string };
  onClose: () => void;
  onImport: (policy: ConflictPolicy) => Promise<void>;
}) {
  const id = useId();
  const [policy, setPolicy] = useState<ConflictPolicy>("keep-both");
  const [busy, setBusy] = useState(false);
  const p = pending?.preview;
  const conflicts = p ? p.projects.existing + p.visualisations.existing : 0;

  const run = async () => {
    setBusy(true);
    try {
      await onImport(policy);
      onClose();
    } catch (error) {
      notify.error("Import failed — nothing was changed", errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(pending)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import backup</DialogTitle>
          <DialogDescription>
            {pending?.name} · exported {p ? new Date(p.exportedAt).toLocaleString() : ""}
          </DialogDescription>
        </DialogHeader>
        {p && (
          <>
            <ul className="grid gap-1 text-sm">
              <li>
                Projects: <strong>{p.projects.new}</strong> new, {p.projects.existing} already here
              </li>
              <li>
                Visualisations: <strong>{p.visualisations.new}</strong> new, {p.visualisations.existing} already here
              </li>
            </ul>
            {conflicts > 0 && (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">For items that already exist</legend>
                {(
                  [
                    ["keep-both", "Keep both", "Add the backup’s copy alongside yours. Nothing is overwritten."],
                    ["skip", "Skip them", "Leave your existing items exactly as they are."],
                  ] as const
                ).map(([value, label, hint]) => (
                  <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
                    <input type="radio" name={`${id}-policy`} checked={policy === value} onChange={() => setPolicy(value)} className="mt-1" />
                    <span>
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-sm text-muted-foreground">{hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <p className="text-sm text-muted-foreground">Imports are all-or-nothing and never overwrite existing work.</p>
          </>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={run} disabled={busy}>
            {busy && <Spinner />} Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

type StorageInfo = { usage?: number; quota?: number; persisted?: boolean } | "unsupported";

function loadStorageInfo(): Promise<StorageInfo> {
  if (!navigator.storage?.estimate) return Promise.resolve("unsupported");
  return Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.()]).then(
    ([estimate, persisted]) => ({ usage: estimate.usage, quota: estimate.quota, persisted }),
    () => "unsupported" as const,
  );
}

function StorageSection() {
  const [info, setInfo] = useState<StorageInfo>();

  useEffect(() => {
    let live = true;
    void loadStorageInfo().then((next) => live && setInfo(next));
    return () => {
      live = false;
    };
  }, []);

  const persist = async () => {
    const granted = await navigator.storage.persist();
    notify[granted ? "success" : "info"](granted ? "Storage will be kept" : "The browser declined", granted ? undefined : "It may grant this later, once you use VIZORA more.");
    setInfo(await loadStorageInfo());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="size-4" aria-hidden="true" /> Local storage
        </CardTitle>
        <CardDescription>Browsers can clear site data under storage pressure. Persistent storage asks the browser not to.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {info === undefined && <p className="text-muted-foreground">Checking…</p>}
        {info === "unsupported" && <p className="text-muted-foreground">This browser does not report storage usage.</p>}
        {info && info !== "unsupported" && (
          <>
            <p>
              Using <strong>{formatBytes(info.usage ?? 0)}</strong>
              {info.quota ? <> of roughly {formatBytes(info.quota)} available</> : null}.
            </p>
            <p>
              Persistence:{" "}
              {info.persisted ? <Badge variant="success">Persistent</Badge> : <Badge variant="warning">Best-effort</Badge>}
            </p>
            {!info.persisted && (
              <div>
                <Button variant="secondary" onClick={() => void persist()}>
                  Request persistent storage
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AboutSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>About</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">App version</dt>
          <dd>{process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}</dd>
          <dt className="text-muted-foreground">Visualisation schema</dt>
          <dd>v{CURRENT_VISUALISATION_SCHEMA_VERSION}</dd>
          <dt className="text-muted-foreground">Project schema</dt>
          <dd>v{CURRENT_PROJECT_SCHEMA_VERSION}</dd>
          <dt className="text-muted-foreground">Backup format</dt>
          <dd>v{CURRENT_BACKUP_VERSION}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
