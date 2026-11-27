import Link from "next/link";
import { JsonLd } from "@/components/marketing/json-ld";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Band, PageHero } from "@/components/marketing/section";
import { MARKETING_ROUTES } from "@/lib/marketing/routes";
import { pageMetadata } from "@/lib/marketing/seo";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Pricing",
  description: "Vizora Free is £0 forever. Pro (indicative £9/month) and Team (indicative £19/user/month) are planned and not available yet.",
  path: MARKETING_ROUTES.pricing.path,
});

export default function PricingPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: SITE_NAME,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web browser",
          url: absoluteUrl("/"),
          // Only the plan that exists is published as an offer.
          offers: { "@type": "Offer", name: "Free", price: "0", priceCurrency: "GBP" },
        }}
      />
      <PageHero
        title="Free today. Plans later."
        lead="Vizora Free is available now, costs nothing and needs no account. Pro and Team are planned; their prices are indicative and may change before they exist."
      />
      <Band id="plans" tone="paper">
        <h2 id="plans-heading" className="sr-only">
          Plans
        </h2>
        <PricingCards />
        <div className="mt-10 grid gap-4 text-body md:grid-cols-3">
          <p>
            <strong className="text-foreground">Free is complete as it stands.</strong> Items marked “planned” inside Free are on the roadmap and are not
            available yet.
          </p>
          <p>
            <strong className="text-foreground">Nothing to buy.</strong> There is no checkout, subscription or waiting list in this version.
          </p>
          <p>
            <strong className="text-foreground">Questions?</strong> Read the{" "}
            <Link href={MARKETING_ROUTES.faq.path} className="font-semibold text-primary-text underline underline-offset-4 hover:no-underline">
              FAQ
            </Link>
            .
          </p>
        </div>
      </Band>
    </>
  );
}
