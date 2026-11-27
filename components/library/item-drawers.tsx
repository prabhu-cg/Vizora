"use client";

import { useId, useState } from "react";
import { Spinner } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@/components/ui/drawer";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRequiredStorage } from "@/hooks/use-storage";
import { ConflictError } from "@/lib/storage";
import { errorMessage, notify } from "@/lib/notify";
import type { Project } from "@/types/project";
import type { VisualisationSummary } from "@/types/visualisation";

/** Rename a saved visualisation. If it was changed elsewhere meanwhile, the rename is refused rather than overwriting that change. */
export function RenameVisualisationDrawer({ item, onClose }: { item?: VisualisationSummary; onClose: () => void }) {
  const storage = useRequiredStorage();
  const id = useId();
  const [title, setTitle] = useState(item?.title ?? "");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const next = title.trim();
    if (!next) return setError("Title is required");
    if (next === item.title) return onClose();
    setBusy(true);
    try {
      const rec = await storage.visualisations.get(item.id);
      if (!rec) throw new Error("This visualisation no longer exists.");
      // expectedRevision comes from the record just read, but if the list on screen was stale the
      // revision differs from what the user saw: surface that instead of silently proceeding.
      if (rec.revision !== item.revision) throw new ConflictError(rec);
      await storage.visualisations.save(item.id, { ...rec.document, title: next }, { expectedRevision: rec.revision });
      notify.success("Renamed", next);
      onClose();
    } catch (err) {
      setError(err instanceof ConflictError ? "This visualisation was changed in another tab or window since this list loaded. Reload the list and try again; your rename was not applied." : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={Boolean(item)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DrawerContent size="sm">
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DrawerHeader title="Rename visualisation" description="Only the title changes." />
          <DrawerBody className="grid content-start gap-3">
            <Label htmlFor={`${id}-t`}>Title</Label>
            <Input id={`${id}-t`} value={title} maxLength={200} autoFocus onChange={(e) => { setTitle(e.target.value); setError(undefined); }} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-e` : undefined} />
            {error && <p id={`${id}-e`} role="alert" className="text-sm text-destructive">{error}</p>}
          </DrawerBody>
          <DrawerFooter>
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Spinner />} Rename</Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

/** Move a visualisation to the end of another project. Its content is untouched. */
export function MoveVisualisationDrawer({ item, projects, onClose }: { item?: VisualisationSummary; projects: Project[]; onClose: () => void }) {
  const storage = useRequiredStorage();
  const id = useId();
  const targets = projects.filter((p) => p.id !== item?.projectId);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !target) return;
    setBusy(true);
    try {
      await storage.visualisations.move(item.id, target);
      notify.success("Moved", `“${item.title}” is now in ${projects.find((p) => p.id === target)?.name ?? "the other project"}.`);
      onClose();
    } catch (err) {
      notify.error("Could not move it", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={Boolean(item)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DrawerContent size="sm">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DrawerHeader title="Move to another project" description={item ? `“${item.title}” moves to the end of the project you choose.` : undefined} />
          <DrawerBody className="grid content-start gap-3">
            {targets.length === 0 ? (
              <p className="text-sm text-muted-foreground">You only have one project. Create another from the dashboard to move things into it.</p>
            ) : (
              <>
                <Label htmlFor={`${id}-p`}>Project</Label>
                <Select id={`${id}-p`} value={target} onChange={(e) => setTarget(e.target.value)} autoFocus>
                  <option value="">Choose a project</option>
                  {targets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </>
            )}
          </DrawerBody>
          <DrawerFooter>
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !target}>{busy && <Spinner />} Move</Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
