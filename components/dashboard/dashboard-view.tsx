"use client";

import { FolderPlus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useFeature } from "@/features/entitlements/client";
import { useProjects, useRecentVisualisations } from "@/features/projects/hooks";
import { useRequiredStorage } from "@/hooks/use-storage";
import { notify } from "@/lib/notify";
import type { ProjectWithStats } from "@/types/project";
import { ProjectCard } from "./project-card";
import { ProjectFormDialog } from "./project-form-dialog";
import { VisualisationRow } from "./visualisation-row";

export function DashboardView() {
  const projects = useProjects();
  const recent = useRecentVisualisations(5);
  const canManage = useFeature("projects.manage");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProjectWithStats>();
  const [deleting, setDeleting] = useState<ProjectWithStats>();

  const projectNames = useMemo(
    () => (projects.status === "ready" ? new Map(projects.data.map((p) => [p.id, p.name])) : new Map<string, string>()),
    [projects],
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your projects and recent work. Everything is stored privately in this browser."
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" /> New project
            </Button>
          )
        }
      />

      {projects.status === "loading" && <LoadingState label="Loading projects" rows={2} />}
      {projects.status === "error" && (
        <ErrorState title="Could not open your projects" message={projects.error.message} onRetry={projects.reload} />
      )}
      {projects.status === "ready" && projects.data.length === 0 && (
        <EmptyState
          icon={FolderPlus}
          title="Create your first project"
          description="Projects keep related visualisations together. Bring in data or sketch a diagram to get started."
          action={
            canManage && (
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" /> New project
              </Button>
            )
          }
        />
      )}
      {projects.status === "ready" && projects.data.length > 0 && (
        <>
          <section aria-labelledby="projects-heading">
            <h2 id="projects-heading" className="mb-3 text-lg font-semibold">
              Projects
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.data.map((project) => (
                <li key={project.id}>
                  <ProjectCard project={project} onEdit={setEditing} onDelete={setDeleting} />
                </li>
              ))}
            </ul>
          </section>

          {recent.status === "ready" && recent.data.length > 0 && (
            <section aria-labelledby="recent-heading" className="mt-10">
              <h2 id="recent-heading" className="mb-3 text-lg font-semibold">
                Recent visualisations
              </h2>
              <ul className="grid gap-3">
                {recent.data.map((v) => (
                  <VisualisationRow key={v.id} item={v} context={projectNames.get(v.projectId)} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <CreateProject open={creating} onOpenChange={setCreating} />
      <EditProject project={editing} onClose={() => setEditing(undefined)} />
      <DeleteProject project={deleting} onClose={() => setDeleting(undefined)} />
    </>
  );
}

function CreateProject({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const storage = useRequiredStorage();
  return (
    <ProjectFormDialog
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={async (input) => {
        const project = await storage.projects.create(input);
        notify.success("Project created", project.name);
      }}
    />
  );
}

function EditProject({ project, onClose }: { project?: ProjectWithStats; onClose: () => void }) {
  const storage = useRequiredStorage();
  return (
    <ProjectFormDialog
      key={project?.id ?? "none"}
      open={Boolean(project)}
      onOpenChange={(o) => !o && onClose()}
      project={project}
      onSubmit={async (input) => {
        if (!project) return;
        await storage.projects.update(project.id, input);
        notify.success("Project updated");
      }}
    />
  );
}

function DeleteProject({ project, onClose }: { project?: ProjectWithStats; onClose: () => void }) {
  const storage = useRequiredStorage();
  const n = project?.visualisationCount ?? 0;
  return (
    <ConfirmDialog
      open={Boolean(project)}
      onOpenChange={(o) => !o && onClose()}
      title={`Delete “${project?.name ?? ""}”?`}
      description={
        <>
          This permanently deletes the project
          {n > 0 ? ` and its ${n} visualisation${n === 1 ? "" : "s"}` : ""} from this browser. This cannot be undone.
          <br />
          Tip: export a backup from Settings first if you might need it.
        </>
      }
      confirmLabel="Delete project"
      onConfirm={async () => {
        if (!project) return;
        await storage.projects.delete(project.id);
        notify.success("Project deleted");
      }}
    />
  );
}
