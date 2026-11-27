"use client";

import { ArrowDown, ArrowUp, Copy, FolderInput, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { ExportMenuItems } from "@/components/library/export-menu-items";
import { RecencyBadge } from "@/components/library/recency-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TYPE_META } from "@/components/visualisations/type-meta";
import type { VisualisationSummary } from "@/types/visualisation";

export interface RowActions {
  onRename?: (v: VisualisationSummary) => void;
  onDuplicate?: (v: VisualisationSummary) => void;
  onMove?: (v: VisualisationSummary) => void;
  onDelete?: (v: VisualisationSummary) => void;
  /** Include an export submenu that loads this visualisation on open. */
  exports?: boolean;
}

export interface RowReorder {
  position: number;
  total: number;
  onUp: () => void;
  onDown: () => void;
}

/** One saved visualisation: a link to open it, how recently it changed, and everything you can do to it. */
export function VisualisationRow({ item, context, actions, reorder }: { item: VisualisationSummary; context?: string; actions?: RowActions; reorder?: RowReorder }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  const hasMenu = actions && (actions.onRename || actions.onDuplicate || actions.onMove || actions.onDelete || actions.exports);
  return (
    <li className={`relative flex items-center gap-3 rounded-card border border-border bg-card p-3 transition-colors hover:border-primary sm:p-4 ${hasMenu ? "pr-14 sm:pr-16" : ""}`}>
      {reorder && (
        <div className="relative z-10 flex flex-col" role="group" aria-label={`Order of ${item.title}`}>
          <Button variant="ghost" size="icon" className="size-7" aria-label={`Move “${item.title}” up`} disabled={reorder.position === 1} onClick={reorder.onUp}>
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" aria-label={`Move “${item.title}” down`} disabled={reorder.position === reorder.total} onClick={reorder.onDown}>
            <ArrowDown aria-hidden="true" />
          </Button>
        </div>
      )}
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold sm:text-base">
          <Link href={`/app/workspace/${item.id}`} className="rounded-sm after:absolute after:inset-0 after:content-['']">
            {item.title}
          </Link>
          {reorder && <span className="sr-only"> (position {reorder.position} of {reorder.total})</span>}
        </h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="soft">{meta.label}</Badge>
          {context && <span className="truncate">{context}</span>}
          <RecencyBadge iso={item.updatedAt} />
        </p>
      </div>
      {hasMenu && (
        <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${item.title}`}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {actions.onRename && <DropdownMenuItem onSelect={() => actions.onRename!(item)}><Pencil aria-hidden="true" /> Rename</DropdownMenuItem>}
              {actions.onDuplicate && <DropdownMenuItem onSelect={() => actions.onDuplicate!(item)}><Copy aria-hidden="true" /> Duplicate</DropdownMenuItem>}
              {actions.onMove && <DropdownMenuItem onSelect={() => actions.onMove!(item)}><FolderInput aria-hidden="true" /> Move to another project…</DropdownMenuItem>}
              {actions.exports && (
                <>
                  <DropdownMenuSeparator />
                  <ExportMenuItems visualisationId={item.id} />
                </>
              )}
              {actions.onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => actions.onDelete!(item)}><Trash2 aria-hidden="true" /> Delete</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  );
}
