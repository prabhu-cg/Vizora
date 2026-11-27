import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { MARKETING_ROUTES } from "@/lib/marketing/routes";
import { TAGLINE } from "@/lib/site";
import { MarketingNav } from "./marketing-nav";

/** Sticky white at 90% with blur and a hairline. */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-[var(--container-marketing)] items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" aria-label="Vizora home" className="rounded-sm">
          <Logo />
        </Link>
        <MarketingNav />
      </div>
    </header>
  );
}

const FOOTER_COLUMNS = [
  { title: "Product", links: [MARKETING_ROUTES.features, MARKETING_ROUTES.howItWorks, MARKETING_ROUTES.useCases, MARKETING_ROUTES.pricing] },
  { title: "Company", links: [MARKETING_ROUTES.about, MARKETING_ROUTES.faq] },
  { title: "Legal", links: [MARKETING_ROUTES.privacy, MARKETING_ROUTES.terms] },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-[var(--container-marketing)] gap-10 px-4 py-12 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{TAGLINE}</p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
            <ul className="mt-3 grid gap-2">
              {col.links.map((l) => (
                <li key={l.path}>
                  <Link href={l.path} className="rounded-sm text-sm text-muted-foreground hover:text-foreground hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-[var(--container-marketing)] px-4 py-5 text-xs text-muted-foreground sm:px-8">
          © {new Date().getFullYear()} Vizora. Free edition. Your projects stay in your browser.
        </p>
      </div>
    </footer>
  );
}
