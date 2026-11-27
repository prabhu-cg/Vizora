import Link from "next/link";
import { StartFreeButton } from "@/components/marketing/cta";
import { Band, PageHero, SectionHeading, StatusBadge } from "@/components/marketing/section";
import { CAPABILITIES, WORKSPACE_FEATURES } from "@/lib/marketing/content";
import { MARKETING_ROUTES } from "@/lib/marketing/routes";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata = pageMetadata({
  title: "About",
  description: "Why Vizora exists, the principles behind it, and an honest account of what is built and what is not.",
  path: MARKETING_ROUTES.about.path,
});

const PRINCIPLES = [
  { title: "Universal, not narrow", body: "Information comes in many shapes. A visualisation tool should handle processes, ideas, timelines and numbers in one workspace." },
  { title: "Local-first and private", body: "Your work lives on your device by default. No account is needed and nothing is uploaded to use the Free edition." },
  { title: "Yours to keep", body: "Everything exports to open files you control, and backups never overwrite your existing work." },
  { title: "Honest about progress", body: "We say what works and what does not. Planned features are labelled as planned, everywhere." },
  { title: "Accessible by design", body: "Keyboard operation, clear focus, readable contrast and light and dark themes are built in, not added later." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        title="See beyond information."
        lead="Vizora exists to help people turn the things they know, in whatever form, into visuals they can understand, explore and edit."
      />
      <Band id="principles" tone="paper">
        <SectionHeading id="principles" title="What we believe" />
        <ul className="grid gap-5 md:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <li key={p.title} className="rounded-card border border-border bg-card p-6">
              <h3 className="font-display text-2xl font-medium">{p.title}</h3>
              <p className="mt-2 text-body">{p.body}</p>
            </li>
          ))}
        </ul>
      </Band>
      <Band id="status" tone="desk">
        <SectionHeading
          id="status"
          title="Where things stand"
          lead="Vizora is early. This is the Free edition, and the list below is the honest state of the product."
        />
        <ul className="grid gap-3 sm:grid-cols-2">
          {[...CAPABILITIES, ...WORKSPACE_FEATURES].map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-card border border-border bg-card px-5 py-3">
              <span className="font-semibold text-foreground">{c.title}</span>
              <StatusBadge status={c.status} />
            </li>
          ))}
        </ul>
        <p className="mt-6 text-body">
          Details are on the{" "}
          <Link href={MARKETING_ROUTES.features.path} className="font-semibold text-primary-text underline underline-offset-4 hover:no-underline">
            Features page
          </Link>
          . Pro and Team are planned; see{" "}
          <Link href={MARKETING_ROUTES.pricing.path} className="font-semibold text-primary-text underline underline-offset-4 hover:no-underline">
            Pricing
          </Link>
          .
        </p>
      </Band>
      <Band id="start">
        <div className="text-center">
          <h2 id="start-heading" className="text-4xl sm:text-5xl">
            Try it yourself
          </h2>
          <div className="mt-8 flex justify-center">
            <StartFreeButton />
          </div>
        </div>
      </Band>
    </>
  );
}
