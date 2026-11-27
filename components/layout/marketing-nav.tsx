"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { APP_HREF, NAV } from "@/lib/marketing/routes";
import { cn } from "@/lib/utils/cn";
import { ThemeMenu } from "./theme-menu";

const linkClass = (active: boolean) =>
  cn(
    "inline-flex min-h-10 items-center rounded-full px-4 text-sm transition-colors",
    active ? "bg-accent font-semibold text-accent-foreground" : "font-medium text-body hover:bg-muted",
  );

/** Sign in is intentionally not a link: accounts do not exist in the Free edition. */
function SignInNotice({ className }: { className?: string }) {
  return (
    <span className={cn("items-center gap-2 px-4 text-sm font-medium text-muted-foreground", className)} title="Accounts are not part of the Free edition">
      Sign in <Badge variant="outline">Soon</Badge>
    </span>
  );
}

function Menu_({ label, items, pathname }: { label: string; items: readonly { path: string; label: string }[]; pathname: string }) {
  const active = items.some((i) => i.path !== "/" && pathname.startsWith(i.path));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(linkClass(active), "gap-1.5")}>
          {label} <ChevronDown className="size-3.5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((i) => (
          <DropdownMenuItem key={i.path} asChild>
            <Link href={i.path} aria-current={pathname === i.path ? "page" : undefined}>
              {i.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MarketingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const all = [...NAV.product.items, ...NAV.primary, ...NAV.resources.items];
  const close = () => setOpen(false);

  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
        <Menu_ label={NAV.product.label} items={NAV.product.items} pathname={pathname} />
        {NAV.primary.map((r) => (
          <Link key={r.path} href={r.path} aria-current={pathname === r.path ? "page" : undefined} className={linkClass(pathname === r.path)}>
            {r.label}
          </Link>
        ))}
        <Menu_ label={NAV.resources.label} items={NAV.resources.items} pathname={pathname} />
      </nav>

      <div className="flex items-center gap-2">
        <SignInNotice className="hidden xl:inline-flex" />
        <ThemeMenu />
        <Button asChild className="hidden sm:inline-flex">
          <Link href={APP_HREF}>Start free</Link>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="lg:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </div>

      <div id={panelId} hidden={!open} className="absolute inset-x-0 top-full border-b border-border bg-background px-4 pb-4 pt-2 lg:hidden">
        <nav aria-label="Mobile">
          <ul className="grid gap-1">
            {all.map((r) => (
              <li key={r.path}>
                <Link href={r.path} onClick={close} aria-current={pathname === r.path ? "page" : undefined} className={cn(linkClass(pathname === r.path), "w-full")}>
                  {r.label}
                </Link>
              </li>
            ))}
            <li>
              <SignInNotice className="inline-flex min-h-10" />
            </li>
            <li className="pt-2">
              <Button asChild className="w-full">
                <Link href={APP_HREF} onClick={close}>
                  Start free
                </Link>
              </Button>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}
