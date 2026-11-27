import type { Metadata } from "next";
import { WorkspaceView } from "@/components/workspace/workspace-view";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspacePage({ params }: PageProps<"/app/workspace/[visualisationId]">) {
  const { visualisationId } = await params;
  return <WorkspaceView visualisationId={visualisationId} />;
}
