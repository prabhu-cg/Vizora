"use client";

import { FolderPlus, Plus, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { ImportBackupButton } from "@/components/library/import-backup";
import { SearchBox, SortSelect } from "@/components/library/library-controls";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useFeature } from "@/features/entitlements/client";
import { useAllVisualisations, useProjects } from "@/features/projects/hooks";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useRequiredStorage } from "@/hooks/use-storage";
import { downloadProjectBackup } from "@/lib/library/backup-actions";
import { searchProjects, searchVisualisations } from "@/lib/library/search";
import { PROJECT_SORTS, sortProjects, type ProjectSort } from "@/lib/library/sort";
import { errorMessage, notify } from "@/lib/notify";
import type { ProjectWithStats } from "@/types/project";
import { ProjectCard, type ProjectActions } from "./project-card";
import { ProjectFormDialog } from "./project-form-dialog";
import { VisualisationRow } from "./visualisation-row";

const isSort = (v: unknown): v is ProjectSort => typeof v === "string" && v in PROJECT_SORTS;

export function DashboardView() {
  const storage = useRequiredStorage();
  const projects = useProjects();
  const visualisations = useAllVisualisations();
  const canManage = useFeature("projects.manage");
  const [query, setQuery] = useState("");
  const [sort, setSort] = usePersistentState<ProjectSort>("vizora-project-sort", "modified", isSort);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProjectWithStats>();
  const [deleting, setDeleting] = useState<ProjectWithStats>();

  const names = useMemo(() => new Map(projects.status === "ready" ? projects.data.map((p) => [p.id, p.name]) : []), [projects]);
  const searching = query.trim().length > 0;

  const actions: ProjectActions = {
    onEdit: setEditing,
    onDelete: setDeleting,
    onDuplicate: async (p) => {
      try {
        const r = await storage.projects.duplicate(p.id);
        notify.success("Project duplicated", `“${r.project.name}” with ${r.visualisations} visualisation${r.visualisations === 1 ? "" : "s"}`);
      } catch (e) {
        notify.error("Could not duplicate the project", errorMessage(e));
      }
    },
    onExport: async (p) => {
      try {
        await downloadProjectBackup(storage, p);
        notify.success("Backup downloaded", `${p.name} (an importable Vizora backup file)`);
      } catch (e) {
        notify.error("Backup failed", errorMessage(e));
      }
    },
  };

  const newProject = canManage && (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden="true" /> New project
    </Button>
  );

  const body = () => {
    if (projects.status === "loading") return <LoadingState label="Loading projects" rows={2} />;
    if (projects.status === "error") return <ErrorState title="Could not open your projects" message={projects.error.message} onRetry={projects.reload} />;
    const list = projects.data;
    const items = visualisations.status === "ready" ? visualisations.data : [];

    if (list.length === 0) {
      return (
        <EmptyState
          icon={FolderPlus}
          title="Create your first project"
          description="Projects keep related visualisations together. Bring in data or sketch a diagram to get started, or restore a backup."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {newProject}
              <ImportBackupButton>Import backup…</ImportBackupButton>
            </div>
          }
        />
      );
    }

    if (searching) {
      const pm = searchProjects(list, query).map((r) => r.item);
      const vm = searchVisualisations(items, (id) => names.get(id), query).map((r) => r.item);
      return (
        <div aria-live="polite">
          <p className="mb-4 text-sm text-muted-foreground">
            {pm.length + vm.length === 0 ? "" : `${pm.length} project${pm.length === 1 ? "" : "s"} and ${vm.length} visualisation${vm.length === 1 ? "" : "s"} match “${query.trim()}”.`}
          </p>
          {pm.length + vm.length === 0 ? (
            <EmptyState icon={SearchX} title="No matches" description={`Nothing in your projects or visualisations matches “${query.trim()}”. Try fewer or different words.`} action={<Button variant="outline" onClick={() => setQuery("")}>Clear search</Button>} />
          ) : (
            <div className="grid gap-8">
              {pm.length > 0 && (
                <section aria-labelledby="found-projects">
                  <h2 id="found-projects" className="mb-3 text-lg">Projects</h2>
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {pm.map((p) => (
                      <li key={p.id}><ProjectCard project={p} actions={actions} /></li>
                    ))}
                  </ul>
                </section>
              )}
              {vm.length > 0 && (
                <section aria-labelledby="found-viz">
                  <h2 id="found-viz" className="mb-3 text-lg">Visualisations</h2>
                  <ul className="grid gap-3">
                    {vm.map((v) => (
                      <VisualisationRow key={v.id} item={v} context={names.get(v.projectId)} />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      );
    }

    const recentProjects = sortProjects(list, "modified").slice(0, 3);
    const recentViz = items.slice(0, 5);
    return (
      <div className="grid gap-10">
        <div className="grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="recent-projects">
            <h2 id="recent-projects" className="mb-3 text-lg">Recent projects</h2>
            <ul className="grid gap-3">
              {recentProjects.map((p) => (
                <li key={p.id}><ProjectCard project={p} actions={actions} /></li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="recent-viz">
            <h2 id="recent-viz" className="mb-3 text-lg">Recent visualisations</h2>
            {recentViz.length === 0 ? (
              <p className="rounded-card border border-dashed border-border-strong p-6 text-sm text-muted-foreground">Nothing yet. Open a project and create a visualisation.</p>
            ) : (
              <ul className="grid gap-3">
                {recentViz.map((v) => (
                  <VisualisationRow key={v.id} item={v} context={names.get(v.projectId)} />
                ))}
              </ul>
            )}
          </section>
        </div>
        <section aria-labelledby="all-projects">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="all-projects" className="text-lg">All projects <span className="text-sm font-normal text-muted-foreground">({list.length})</span></h2>
            <SortSelect label="Sort" value={sort} onChange={setSort} options={PROJECT_SORTS} />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="All projects">
            {sortProjects(list, sort).map((p) => (
              <li key={p.id}><ProjectCard project={p} actions={actions} /></li>
            ))}
          </ul>
        </section>
      </div>
    );
  };

  const hasProjects = projects.status === "ready" && projects.data.length > 0;
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your projects and recent work. Everything is stored privately in this browser."
        actions={
          <>
            <ImportBackupButton />
            {newProject}
          </>
        }
      />
      {hasProjects && (
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <SearchBox value={query} onChange={setQuery} label="Search projects and visualisations" placeholder="Search projects and visualisations" />
          {searching && <SortSelect label="Sort projects" value={sort} onChange={setSort} options={PROJECT_SORTS} />}
        </div>
      )}
      {body()}

      <CreateProject open={creating} onOpenChange={setCreating} />
      <EditProject project={editing} onClose={() => setEditing(undefined)} />
      <DeleteProject project={deleting} onClose={() => setDeleting(undefined)} onExport={actions.onExport} />
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

function DeleteProject({ project, onClose, onExport }: { project?: ProjectWithStats; onClose: () => void; onExport: (p: ProjectWithStats) => void }) {
  const storage = useRequiredStorage();
  const n = project?.visualisationCount ?? 0;
  return (
    <ConfirmDialog
      open={Boolean(project)}
      onOpenChange={(o) => !o && onClose()}
      title={`Delete “${project?.name ?? ""}”?`}
      description={
        <>
          This permanently deletes the project{n > 0 ? ` and its ${n} visualisation${n === 1 ? "" : "s"}` : ""} from this browser. It is not stored anywhere else, so this cannot be undone.
          <br />
          {project && (
            <Button variant="link" size="sm" className="mt-2 h-auto p-0" onClick={() => onExport(project)}>
              Download a backup of this project first
            </Button>
          )}
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
