"use client";

import { ArrowLeft, Copy, Download, Pencil, Plus, SearchX, Shapes, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MoveVisualisationDrawer, RenameVisualisationDrawer } from "@/components/library/item-drawers";
import { SearchBox, SortSelect } from "@/components/library/library-controls";
import { RecencyBadge } from "@/components/library/recency-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { TYPE_META } from "@/components/visualisations/type-meta";
import { useProject, useProjectVisualisations, useProjects } from "@/features/projects/hooks";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useRequiredStorage } from "@/hooks/use-storage";
import { downloadProjectBackup } from "@/lib/library/backup-actions";
import { searchVisualisations } from "@/lib/library/search";
import { VISUALISATION_SORTS, moveId, sortVisualisations, type VisualisationSort } from "@/lib/library/sort";
import { errorMessage, notify } from "@/lib/notify";
import type { VisualisationSummary } from "@/types/visualisation";
import { NewVisualisationDialog } from "./new-visualisation-dialog";
import { ProjectFormDialog } from "./project-form-dialog";
import { VisualisationRow } from "./visualisation-row";

const isSort = (v: unknown): v is VisualisationSort => typeof v === "string" && v in VISUALISATION_SORTS;
const date = (iso: string) => new Date(iso).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });

function typeSummary(items: readonly VisualisationSummary[]): string {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.type, (counts.get(i.type) ?? 0) + 1);
  return [...counts.entries()].map(([t, n]) => `${n} ${TYPE_META[t as VisualisationSummary["type"]].label.toLowerCase()}${n === 1 ? "" : "s"}`).join(", ");
}

export function ProjectView({ projectId }: { projectId: string }) {
  const storage = useRequiredStorage();
  const router = useRouter();
  const project = useProject(projectId);
  const allProjects = useProjects();
  const items = useProjectVisualisations(projectId);
  const [query, setQuery] = useState("");
  const [sort, setSort] = usePersistentState<VisualisationSort>("vizora-viz-sort", "custom", isSort);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleting, setDeleting] = useState<VisualisationSummary>();
  const [renaming, setRenaming] = useState<VisualisationSummary>();
  const [moving, setMoving] = useState<VisualisationSummary>();
  const [announce, setAnnounce] = useState("");

  const customOrder = useMemo(() => (items.status === "ready" ? sortVisualisations(items.data, "custom") : []), [items]);
  const shown = useMemo(() => {
    if (items.status !== "ready") return [];
    const sorted = sortVisualisations(items.data, sort);
    if (!query.trim()) return sorted;
    const hits = new Set(searchVisualisations(sorted, () => "", query).map((r) => r.item.id));
    return sorted.filter((v) => hits.has(v.id));
  }, [items, sort, query]);

  const back = (
    <Link href="/app/dashboard" className="inline-flex items-center gap-1.5 rounded-sm font-medium text-primary-text hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" /> All projects
    </Link>
  );

  if (project.status === "loading") return <LoadingState label="Loading project" rows={2} />;
  if (project.status === "error") return <ErrorState title="Could not open this project" message={project.error.message} onRetry={project.reload} />;
  if (!project.data) {
    return (
      <EmptyState icon={Shapes} title="Project not found" description="It may have been deleted, or the link is wrong." action={<Button asChild><Link href="/app/dashboard">Back to dashboard</Link></Button>} />
    );
  }
  const p = project.data;
  const total = items.status === "ready" ? items.data.length : 0;
  const reorderable = sort === "custom" && !query.trim();
  const otherProjects = allProjects.status === "ready" ? allProjects.data : [];

  const reorder = async (id: string, delta: -1 | 1) => {
    const ids = customOrder.map((v) => v.id);
    const next = moveId(ids, id, delta);
    try {
      await storage.visualisations.reorder(projectId, next);
      const title = customOrder.find((v) => v.id === id)?.title ?? "Item";
      setAnnounce(`Moved “${title}” to position ${next.indexOf(id) + 1} of ${next.length}.`);
    } catch (e) {
      notify.error("Could not reorder", errorMessage(e));
    }
  };

  const duplicate = async (v: VisualisationSummary) => {
    try {
      const copy = await storage.visualisations.duplicate(v.id);
      notify.success("Duplicated", copy.document.title);
    } catch (e) {
      notify.error("Could not duplicate", errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={back}
        title={p.name}
        description={p.description || undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil aria-hidden="true" /> Edit</Button>
            <Button variant="outline" onClick={async () => {
              try {
                const r = await storage.projects.duplicate(p.id);
                notify.success("Project duplicated", r.project.name);
                router.push(`/app/dashboard/${r.project.id}`);
              } catch (e) {
                notify.error("Could not duplicate the project", errorMessage(e));
              }
            }}><Copy aria-hidden="true" /> Duplicate</Button>
            <Button variant="outline" onClick={async () => {
              try {
                await downloadProjectBackup(storage, p);
                notify.success("Backup downloaded", p.name);
              } catch (e) {
                notify.error("Backup failed", errorMessage(e));
              }
            }}><Download aria-hidden="true" /> Backup</Button>
            <Button variant="destructive" onClick={() => setDeletingProject(true)}><Trash2 aria-hidden="true" /> Delete</Button>
            <Button onClick={() => setCreating(true)}><Plus aria-hidden="true" /> New visualisation</Button>
          </>
        }
      />

      <dl className="-mt-4 mb-8 flex flex-wrap gap-x-8 gap-y-2 text-sm" aria-label="Project details">
        <div><dt className="inline text-muted-foreground">Created </dt><dd className="inline">{date(p.createdAt)}</dd></div>
        <div><dt className="inline text-muted-foreground">Updated </dt><dd className="inline"><RecencyBadge iso={p.updatedAt} label="" /></dd></div>
        <div><dt className="inline text-muted-foreground">Contains </dt><dd className="inline">{total} visualisation{total === 1 ? "" : "s"}{total > 0 && items.status === "ready" ? ` (${typeSummary(items.data)})` : ""}</dd></div>
      </dl>

      {items.status === "loading" && <LoadingState label="Loading visualisations" rows={2} />}
      {items.status === "error" && <ErrorState message={items.error.message} onRetry={items.reload} />}
      {items.status === "ready" && total === 0 && (
        <EmptyState icon={Shapes} title="No visualisations yet" description="Create a flowchart, mind map, chart or dashboard. Describe or paste what you want, or start from a blank canvas." action={<Button onClick={() => setCreating(true)}><Plus aria-hidden="true" /> New visualisation</Button>} />
      )}
      {items.status === "ready" && total > 0 && (
        <>
          <h2 className="sr-only">Visualisations in this project</h2>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SearchBox value={query} onChange={setQuery} label="Search this project" placeholder="Search this project" />
            <SortSelect label="Sort" value={sort} onChange={setSort} options={VISUALISATION_SORTS} />
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {reorderable ? "Use the arrows to put them in the order you want." : query.trim() ? "Clear the search to rearrange." : "Choose “My order” to rearrange."}
          </p>
          <div role="status" aria-live="polite" className="sr-only">{announce}</div>
          {shown.length === 0 ? (
            <EmptyState icon={SearchX} title="No matches" description={`Nothing in this project matches “${query.trim()}”.`} action={<Button variant="outline" onClick={() => setQuery("")}>Clear search</Button>} />
          ) : (
            <ul className="grid gap-3" aria-label="Visualisations">
              {shown.map((v, i) => (
                <VisualisationRow
                  key={v.id}
                  item={v}
                  actions={{ onRename: setRenaming, onDuplicate: duplicate, onMove: setMoving, onDelete: setDeleting, exports: true }}
                  reorder={reorderable ? { position: i + 1, total: shown.length, onUp: () => void reorder(v.id, -1), onDown: () => void reorder(v.id, 1) } : undefined}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <NewVisualisationDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={async (doc) => {
          const record = await storage.visualisations.create(projectId, doc);
          router.push(`/app/workspace/${record.id}`);
        }}
      />
      <ProjectFormDialog
        open={editing}
        onOpenChange={setEditing}
        project={p}
        onSubmit={async (input) => {
          await storage.projects.update(p.id, input);
          notify.success("Project updated");
        }}
      />
      <RenameVisualisationDrawer key={renaming?.id ?? "r"} item={renaming} onClose={() => setRenaming(undefined)} />
      <MoveVisualisationDrawer key={moving?.id ?? "m"} item={moving} projects={otherProjects} onClose={() => setMoving(undefined)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="This permanently deletes the visualisation from this browser. It is not stored anywhere else, so this cannot be undone."
        confirmLabel="Delete visualisation"
        onConfirm={async () => {
          if (!deleting) return;
          await storage.visualisations.delete(deleting.id);
          notify.success("Visualisation deleted");
        }}
      />
      <ConfirmDialog
        open={deletingProject}
        onOpenChange={setDeletingProject}
        title={`Delete “${p.name}”?`}
        description={`This permanently deletes the project${total > 0 ? ` and its ${total} visualisation${total === 1 ? "" : "s"}` : ""} from this browser. It is not stored anywhere else, so this cannot be undone. Use Backup first if you might need it.`}
        confirmLabel="Delete project"
        onConfirm={async () => {
          await storage.projects.delete(p.id);
          notify.success("Project deleted");
          router.push("/app/dashboard");
        }}
      />
    </>
  );
}
