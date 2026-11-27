"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { APP_NAV } from "./nav-items";

export function NavLinks({ onNavigate, orientation = "vertical" }: { onNavigate?: () => void; orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary">
      <ul className={cn("flex gap-1", orientation === "vertical" ? "flex-col" : "flex-row")}>
        {APP_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-body hover:bg-muted",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
