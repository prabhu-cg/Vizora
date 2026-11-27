import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeMenu } from "./theme-menu";

/** Sticky white at 90% with blur and a hairline. */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[var(--container-marketing)] items-center justify-between px-4 sm:px-8">
        <Link href="/" aria-label="Vizora home" className="rounded-sm">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeMenu />
          <Button asChild>
            <Link href="/app/dashboard">Open Vizora</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[var(--container-marketing)] flex-col gap-3 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Logo />
        <p>See beyond information</p>
      </div>
    </footer>
  );
}
