"use client";

import { Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Spinner } from "@/components/shared/loading-state";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@/components/ui/drawer";
import { useRequiredStorage } from "@/hooks/use-storage";
import { errorMessage, notify } from "@/lib/notify";
import { parseBackupText } from "@/lib/storage";
import type { BackupPreview, ConflictPolicy } from "@/types/data";

interface Pending {
  raw: unknown;
  preview: BackupPreview;
  name: string;
}

/**
 * Restore from a Vizora backup file (a whole library or a single project). The
 * file is fully validated and previewed first; nothing is written until you
 * confirm, and existing work is never overwritten.
 */
export function ImportBackupButton({ variant = "outline", size, children }: { variant?: ButtonProps["variant"]; size?: ButtonProps["size"]; children?: React.ReactNode }) {
  const storage = useRequiredStorage();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending>();
  const [reading, setReading] = useState(false);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      const raw = parseBackupText(await file.text());
      setPending({ raw, preview: await storage.backup.preview(raw), name: file.name });
    } catch (error) {
      notify.error("Cannot import that file", errorMessage(error));
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <input ref={input} type="file" accept=".json,application/json" className="sr-only" aria-label="Choose a Vizora backup file" tabIndex={-1} onChange={(e) => void choose(e.target.files?.[0])} />
      <Button variant={variant} size={size} disabled={reading} onClick={() => input.current?.click()}>
        {reading ? <Spinner /> : <Upload aria-hidden="true" />} {children ?? "Import backup…"}
      </Button>
      <ImportBackupDrawer
        pending={pending}
        onClose={() => setPending(undefined)}
        onImport={async (policy) => {
          if (!pending) return;
          const r = await storage.backup.import(pending.raw, policy);
          const added = `${r.projectsAdded} project${r.projectsAdded === 1 ? "" : "s"} and ${r.visualisationsAdded} visualisation${r.visualisationsAdded === 1 ? "" : "s"} added`;
          const skipped = r.projectsSkipped + r.visualisationsSkipped;
          notify.success("Backup imported", skipped ? `${added}; ${skipped} existing left as they were.` : added);
        }}
      />
    </>
  );
}

function ImportBackupDrawer({ pending, onClose, onImport }: { pending?: Pending; onClose: () => void; onImport: (p: ConflictPolicy) => Promise<void> }) {
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
      notify.error("Import failed. Nothing was changed.", errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={Boolean(pending)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DrawerContent size="lg">
        <DrawerHeader title="Import backup" description={`${pending?.name ?? ""} · exported ${p ? new Date(p.exportedAt).toLocaleString() : ""}`} />
        <DrawerBody className="grid content-start gap-5">
          {p && (
            <>
              <p className="rounded-input bg-success-soft p-3 text-sm text-success" role="status">
                This file is a valid Vizora backup. Nothing has been imported yet.
              </p>
              <section aria-labelledby={`${id}-c`} className="grid gap-2">
                <h3 id={`${id}-c`} className="text-[15px] font-semibold">What is in the file</h3>
                <ul className="grid gap-1.5">
                  {p.contents.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 rounded-input border border-border px-3 py-2 text-sm">
                      <span className="min-w-0 truncate font-medium" title={c.name}>{c.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {c.visualisations} visualisation{c.visualisations === 1 ? "" : "s"}
                        {c.exists ? " · already here" : " · new"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-body">
                  Projects: <strong>{p.projects.new}</strong> new, {p.projects.existing} already here. Visualisations: <strong>{p.visualisations.new}</strong> new, {p.visualisations.existing} already here.
                </p>
              </section>

              {conflicts > 0 && (
                <>
                  <section aria-labelledby={`${id}-x`} className="grid gap-2">
                    <h3 id={`${id}-x`} className="text-[15px] font-semibold">Already in your library</h3>
                    <ul className="grid max-h-40 gap-1 overflow-auto text-sm text-body" tabIndex={0} aria-label="Items that already exist">
                      {p.conflicts.map((c) => (
                        <li key={`${c.kind}-${c.id}`}>
                          <span className="text-muted-foreground">{c.kind === "project" ? "Project" : "Visualisation"}:</span> {c.name}
                        </li>
                      ))}
                    </ul>
                    {conflicts > p.conflicts.length && <p className="text-xs text-muted-foreground">…and {conflicts - p.conflicts.length} more.</p>}
                  </section>
                  <fieldset className="grid gap-2">
                    <legend className="mb-1 text-sm font-medium">For items that already exist</legend>
                    {(
                      [
                        ["keep-both", "Keep both", "Add the backup's copy alongside yours, clearly labelled. Nothing is overwritten."],
                        ["skip", "Skip them", "Leave your existing items exactly as they are."],
                      ] as const
                    ).map(([value, label, hint]) => (
                      <label key={value} className="flex cursor-pointer items-start gap-3 rounded-card border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
                        <input type="radio" name={`${id}-policy`} checked={policy === value} onChange={() => setPolicy(value)} className="mt-1" />
                        <span>
                          <span className="block text-sm font-medium">{label}</span>
                          <span className="block text-sm text-muted-foreground">{hint}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </>
              )}
              <p className="text-sm text-muted-foreground">Importing is all-or-nothing and never overwrites existing work.</p>
            </>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={run} disabled={busy}>
            {busy && <Spinner />} Import
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
