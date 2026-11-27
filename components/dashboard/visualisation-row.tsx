"use client";

import { Copy, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TYPE_META } from "@/components/visualisations/type-meta";
import { formatRelative } from "@/lib/utils/time";
import type { VisualisationSummary } from "@/types/visualisation";

export function VisualisationRow({
  item,
  context,
  onDuplicate,
  onDelete,
}: {
  item: VisualisationSummary;
  /** Secondary label, e.g. the owning project's name. */
  context?: string;
  onDuplicate?: (v: VisualisationSummary) => void;
  onDelete?: (v: VisualisationSummary) => void;
}) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  return (
    <li className="relative flex items-center gap-3 rounded-lg border border-border bg-card p-3 pr-14 shadow-xs transition-shadow hover:shadow-md sm:p-4 sm:pr-16">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-soft text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold sm:text-base">
          <Link href={`/app/workspace/${item.id}`} className="rounded-sm after:absolute after:inset-0 after:content-['']">
            {item.title}
          </Link>
        </h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="blue">{meta.label}</Badge>
          {context && <span className="truncate">{context}</span>}
          <span>Updated {formatRelative(item.updatedAt)}</span>
        </p>
      </div>
      {(onDuplicate || onDelete) && (
        <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${item.title}`}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {onDuplicate && (
                <DropdownMenuItem onSelect={() => onDuplicate(item)}>
                  <Copy aria-hidden="true" /> Duplicate
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem destructive onSelect={() => onDelete(item)}>
                  <Trash2 aria-hidden="true" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  );
}
