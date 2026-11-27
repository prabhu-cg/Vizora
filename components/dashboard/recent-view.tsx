"use client";

import { Clock, Folder } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { RecencyBadge } from "@/components/library/recency-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useAllVisualisations, useProjects } from "@/features/projects/hooks";
import { sortProjects } from "@/lib/library/sort";
import { VisualisationRow } from "./visualisation-row";

/** What you worked on most recently: projects and visualisations, newest first. */
export function RecentView() {
  const projects = useProjects();
  const visualisations = useAllVisualisations();
  const names = useMemo(() => new Map(projects.status === "ready" ? projects.data.map((p) => [p.id, p.name]) : []), [projects]);

  const body = () => {
    if (projects.status === "loading" || visualisations.status === "loading") return <LoadingState label="Loading recent work" rows={2} />;
    if (projects.status === "error") return <ErrorState title="Could not open your projects" message={projects.error.message} onRetry={projects.reload} />;
    if (visualisations.status === "error") return <ErrorState title="Could not open your visualisations" message={visualisations.error.message} onRetry={visualisations.reload} />;
    const recentProjects = sortProjects(projects.data, "modified").slice(0, 6);
    const recentViz = visualisations.data.slice(0, 10);
    if (recentProjects.length === 0) {
      return <EmptyState icon={Clock} title="Nothing recent yet" description="Projects and visualisations you create or edit show up here, newest first." action={<Button asChild><Link href="/app/dashboard">Go to the dashboard</Link></Button>} />;
    }
    return (
      <div className="grid gap-10">
        <section aria-labelledby="recent-projects">
          <h2 id="recent-projects" className="mb-3 text-lg">Recent projects</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((p) => (
              <li key={p.id} className="relative flex items-start gap-3 rounded-card border border-border bg-card p-4 transition-colors hover:border-primary">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
                  <Folder className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">
                    <Link href={`/app/dashboard/${p.id}`} className="rounded-sm after:absolute after:inset-0 after:content-['']">{p.name}</Link>
                  </h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{p.visualisationCount} visualisation{p.visualisationCount === 1 ? "" : "s"}</span>
                    <RecencyBadge iso={p.updatedAt} />
                  </p>
                </div>
              </li>
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
    );
  };

  return (
    <>
      <PageHeader title="Recent" description="Your latest projects and visualisations. Manage them from the dashboard." />
      {body()}
    </>
  );
}
