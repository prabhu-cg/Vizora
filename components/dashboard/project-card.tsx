"use client";

import { Copy, Download, Folder, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { RecencyBadge } from "@/components/library/recency-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ProjectWithStats } from "@/types/project";

export interface ProjectActions {
  onEdit: (p: ProjectWithStats) => void;
  onDuplicate: (p: ProjectWithStats) => void;
  onExport: (p: ProjectWithStats) => void;
  onDelete: (p: ProjectWithStats) => void;
}

const created = (iso: string) => new Date(iso).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });

export function ProjectCard({ project, actions }: { project: ProjectWithStats; actions: ProjectActions }) {
  const n = project.visualisationCount;
  return (
    <Card className="group relative transition-colors hover:border-primary focus-within:border-primary">
      <div className="flex items-start gap-3 p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
          <Folder className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 pr-8">
          <h3 className="truncate text-base font-semibold">
            {/* Stretched link: the whole card is clickable with one tab stop. */}
            <Link href={`/app/dashboard/${project.id}`} className="rounded-sm after:absolute after:inset-0 after:content-['']">
              {project.name}
            </Link>
          </h3>
          <p className="mt-0.5 line-clamp-2 min-h-10 text-sm text-muted-foreground [overflow-wrap:anywhere]">{project.description || "No description"}</p>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              {n} visualisation{n === 1 ? "" : "s"}
            </span>
            <RecencyBadge iso={project.updatedAt} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Created {created(project.createdAt)}</p>
        </div>
      </div>
      <div className="absolute right-2 top-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${project.name}`}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => actions.onEdit(project)}><Pencil aria-hidden="true" /> Edit details</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onDuplicate(project)}><Copy aria-hidden="true" /> Duplicate project</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onExport(project)}><Download aria-hidden="true" /> Download backup</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => actions.onDelete(project)}><Trash2 aria-hidden="true" /> Delete project</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
