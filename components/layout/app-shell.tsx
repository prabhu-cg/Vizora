"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { StorageGate } from "@/hooks/use-storage";
import { NavLinks } from "./nav-links";
import { PlanBadge } from "./plan-badge";
import { ThemeMenu } from "./theme-menu";

/** Desk sidebar (288px) beside a paper content area capped at 1400px. */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[var(--sidebar-width)_1fr]">
      <aside className="hidden border-r border-border bg-surface lg:flex lg:flex-col" aria-label="Sidebar">
        <div className="flex h-16 items-center px-6">
          <Link href="/app/dashboard" aria-label="Vizora dashboard" className="rounded-sm">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 px-4 py-2">
          <NavLinks />
        </div>
        <p className="border-t border-border px-6 py-4 text-xs text-muted-foreground">Local-first. Your work stays in this browser.</p>
      </aside>

      <div className="flex min-w-0 flex-col bg-background">
        {/* 3px amber rule atop the mobile header */}
        <header className="sticky top-0 z-30 border-t-[3px] border-t-primary border-b border-b-border bg-surface/95 backdrop-blur lg:border-t-0">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/app/dashboard" aria-label="Vizora dashboard" className="rounded-sm lg:hidden">
              <Logo />
            </Link>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-2">
              <PlanBadge />
              <ThemeMenu />
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-expanded={open}
                aria-controls={menuId}
                aria-label={open ? "Close menu" : "Open menu"}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
              </Button>
            </div>
          </div>
          <div id={menuId} hidden={!open} className="border-t border-border px-4 py-2 lg:hidden">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[var(--container-app)] flex-1 px-4 py-8 outline-none sm:px-6 lg:px-8">
          <StorageGate>{children}</StorageGate>
        </main>
      </div>
    </div>
  );
}
