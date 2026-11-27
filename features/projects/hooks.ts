"use client";

import { useCallback } from "react";
import { useStorageQuery } from "@/hooks/use-storage-query";
import type { ChangeEvent, VizoraStorage } from "@/lib/storage";
import type { ProjectWithStats } from "@/types/project";
import type { VisualisationSummary } from "@/types/visualisation";

const anyProjectChange = (e: ChangeEvent) => e.scope === "projects" || e.scope === "visualisations" || e.scope === "all";
const anyVisualisationChange = (e: ChangeEvent) => e.scope === "visualisations" || e.scope === "all";

export function useProjects() {
  const query = useCallback(async (s: VizoraStorage): Promise<ProjectWithStats[]> => {
    const [projects, visualisations] = await Promise.all([s.projects.list(), s.visualisations.listAll()]);
    const counts = new Map<string, number>();
    for (const v of visualisations) counts.set(v.projectId, (counts.get(v.projectId) ?? 0) + 1);
    return projects.map((p) => ({ ...p, visualisationCount: counts.get(p.id) ?? 0 }));
  }, []);
  return useStorageQuery(query, anyProjectChange);
}

export function useProject(projectId: string) {
  const query = useCallback((s: VizoraStorage) => s.projects.get(projectId), [projectId]);
  return useStorageQuery(query, anyProjectChange);
}

export function useProjectVisualisations(projectId: string) {
  const query = useCallback((s: VizoraStorage) => s.visualisations.listByProject(projectId), [projectId]);
  return useStorageQuery(query, anyVisualisationChange);
}

export function useRecentVisualisations(limit = 6) {
  const query = useCallback(
    async (s: VizoraStorage): Promise<VisualisationSummary[]> => (await s.visualisations.listAll()).slice(0, limit),
    [limit],
  );
  return useStorageQuery(query, anyVisualisationChange);
}
