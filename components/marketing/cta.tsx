import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { APP_HREF, MARKETING_ROUTES } from "@/lib/marketing/routes";

type Size = "md" | "lg";

/** Opens the working Free dashboard. No account step exists. */
export function StartFreeButton({ size = "lg", label = "Start visualising — Free" }: { size?: Size; label?: string }) {
  return (
    <Button asChild size={size}>
      <Link href={APP_HREF}>
        {label} <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  );
}

export function SecondaryCta({ href, label, size = "lg" }: { href: string; label: string; size?: Size }) {
  return (
    <Button asChild variant="outline" size={size}>
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export const exploreCapabilities = { href: `${MARKETING_ROUTES.features.path}#capabilities`, label: "Explore capabilities" };
export const seeHowItWorks = { href: MARKETING_ROUTES.howItWorks.path, label: "See how it works" };
