import type { Metadata } from "next";
import { ProjectView } from "@/components/dashboard/project-view";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/app/dashboard/[projectId]">) {
  const { projectId } = await params;
  return <ProjectView projectId={projectId} />;
}
