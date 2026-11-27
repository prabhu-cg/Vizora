"use client";

import { Folder, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatRelative } from "@/lib/utils/time";
import type { ProjectWithStats } from "@/types/project";

export function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: ProjectWithStats;
  onEdit: (p: ProjectWithStats) => void;
  onDelete: (p: ProjectWithStats) => void;
}) {
  const count = project.visualisationCount;
  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3 p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-soft text-brand-violet">
          <Folder className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 pr-8">
          <h3 className="truncate text-base font-semibold">
            {/* Stretched link: whole card is clickable, one tab stop. */}
            <Link href={`/app/dashboard/${project.id}`} className="rounded-sm after:absolute after:inset-0 after:content-['']">
              {project.name}
            </Link>
          </h3>
          <p className="mt-0.5 line-clamp-2 min-h-10 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {project.description || "No description"}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {count} visualisation{count === 1 ? "" : "s"} · Updated {formatRelative(project.updatedAt)}
          </p>
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
            <DropdownMenuItem onSelect={() => onEdit(project)}>
              <Pencil aria-hidden="true" /> Edit details
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={() => onDelete(project)}>
              <Trash2 aria-hidden="true" /> Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
