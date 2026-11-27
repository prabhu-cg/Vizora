import type { ReactNode } from "react";
import { getContactEmail } from "@/lib/site";

/** Desk ground, narrow column, one paper card holding the whole document. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated?: string; intro?: string; children: ReactNode }) {
  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <h1 className="text-4xl sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 text-base text-muted-foreground">{intro}</p>}
        {updated && <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>}
        <div className="mt-8 rounded-card border border-border bg-card p-6 text-sm text-muted-foreground sm:p-8 [&_a]:font-semibold [&_a]:text-primary-text [&_a]:underline [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1.5 [&_section+section]:mt-8">
          {children}
        </div>
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      {/* Section titles are DM Sans 600 per the system; `!` beats the unlayered heading rule. */}
      <h2 className="!font-sans !text-base !font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** Shown only when NEXT_PUBLIC_CONTACT_EMAIL is configured, so no address is ever invented. */
export function ContactSection() {
  const email = getContactEmail();
  if (!email) return null;
  return (
    <LegalSection title="Contact">
      <p>
        Questions about this document: <a href={`mailto:${email}`}>{email}</a>.
      </p>
    </LegalSection>
  );
}
