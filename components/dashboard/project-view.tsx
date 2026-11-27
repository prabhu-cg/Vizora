"use client";

import { ArrowLeft, Pencil, Plus, Shapes } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useProject, useProjectVisualisations } from "@/features/projects/hooks";
import { useRequiredStorage } from "@/hooks/use-storage";
import { notify } from "@/lib/notify";
import type { VisualisationSummary } from "@/types/visualisation";
import { NewVisualisationDialog } from "./new-visualisation-dialog";
import { ProjectFormDialog } from "./project-form-dialog";
import { VisualisationRow } from "./visualisation-row";

export function ProjectView({ projectId }: { projectId: string }) {
  const storage = useRequiredStorage();
  const router = useRouter();
  const project = useProject(projectId);
  const items = useProjectVisualisations(projectId);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<VisualisationSummary>();

  const back = (
    <Link href="/app/dashboard" className="inline-flex items-center gap-1.5 rounded-sm font-medium text-primary-text hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" /> All projects
    </Link>
  );

  if (project.status === "loading") return <LoadingState label="Loading project" rows={2} />;
  if (project.status === "error") {
    return <ErrorState title="Could not open this project" message={project.error.message} onRetry={project.reload} />;
  }
  if (!project.data) {
    return (
      <EmptyState
        icon={Shapes}
        title="Project not found"
        description="It may have been deleted, or the link is wrong."
        action={
          <Button asChild>
            <Link href="/app/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    );
  }
  const p = project.data;

  return (
    <>
      <PageHeader
        eyebrow={back}
        title={p.name}
        description={p.description || undefined}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" /> Edit
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" /> New visualisation
            </Button>
          </>
        }
      />

      {items.status === "loading" && <LoadingState label="Loading visualisations" rows={2} />}
      {items.status === "error" && <ErrorState message={items.error.message} onRetry={items.reload} />}
      {items.status === "ready" && items.data.length === 0 && (
        <EmptyState
          icon={Shapes}
          title="No visualisations yet"
          description="Create a diagram to sketch relationships, or a chart to explore imported data."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" /> New visualisation
            </Button>
          }
        />
      )}
      {items.status === "ready" && items.data.length > 0 && (
        <ul className="grid gap-3" aria-label="Visualisations">
          {items.data.map((v) => (
            <VisualisationRow
              key={v.id}
              item={v}
              onDelete={setDeleting}
              onDuplicate={async (item) => {
                try {
                  const copy = await storage.visualisations.duplicate(item.id);
                  notify.success("Duplicated", copy.document.title);
                } catch (e) {
                  notify.error("Could not duplicate", e instanceof Error ? e.message : undefined);
                }
              }}
            />
          ))}
        </ul>
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
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="This permanently deletes the visualisation from this browser. This cannot be undone."
        confirmLabel="Delete visualisation"
        onConfirm={async () => {
          if (!deleting) return;
          await storage.visualisations.delete(deleting.id);
          notify.success("Visualisation deleted");
        }}
      />
    </>
  );
}
