import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { StartFreeButton } from "@/components/marketing/cta";
import { JsonLd } from "@/components/marketing/json-ld";
import { Band, PageHero } from "@/components/marketing/section";
import { FAQS } from "@/lib/marketing/content";
import { MARKETING_ROUTES } from "@/lib/marketing/routes";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata = pageMetadata({
  title: "FAQ",
  description: "Answers about Vizora: what it is, what is free, where your data is stored, what you can visualise and what is planned.",
  path: MARKETING_ROUTES.faq.path,
});

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
      <PageHero title="Frequently asked questions" lead="Straight answers, based on what Vizora does today." />
      <Band id="questions" tone="paper">
        <h2 id="questions-heading" className="sr-only">
          Questions
        </h2>
        <div className="mx-auto max-w-3xl divide-y divide-border rounded-card border border-border bg-card">
          {FAQS.map((f) => (
            <details key={f.q} className="group px-5 py-1">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-3 text-[15px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="pb-4 text-body">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-body">
          More on how your data is handled is in the{" "}
          <Link href={MARKETING_ROUTES.privacy.path} className="font-semibold text-primary-text underline underline-offset-4 hover:no-underline">
            Privacy policy
          </Link>
          .
        </p>
        <div className="mt-8 flex justify-center">
          <StartFreeButton />
        </div>
      </Band>
    </>
  );
}
