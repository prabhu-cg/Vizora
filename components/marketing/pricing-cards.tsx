import { Check, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PLANS, type Plan } from "@/lib/marketing/content";
import { cn } from "@/lib/utils/cn";
import { StartFreeButton } from "./cta";

function PlanCard({ plan }: { plan: Plan }) {
  const headingId = `plan-${plan.id.toLowerCase()}`;
  return (
    <li className={cn("flex flex-col rounded-card border bg-card p-6", plan.available ? "border-primary" : "border-border")}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="font-display text-3xl font-medium">
          {plan.name}
        </h3>
        {plan.available ? <Badge variant="success">Available now</Badge> : <Badge variant="soft">Coming soon</Badge>}
      </div>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="font-display text-5xl font-medium text-foreground">{plan.price}</span>
        <span className="text-sm text-muted-foreground">{plan.priceNote}</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{plan.blurb}</p>

      <ul className="mt-6 grid flex-1 content-start gap-2.5" aria-labelledby={headingId}>
        {plan.items.map((item) => (
          <li key={item.text} className="flex items-start gap-2.5 text-body">
            {item.status === "available" ? (
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <span className={item.status === "available" ? undefined : "text-muted-foreground"}>
              {item.text}
              <span className="sr-only"> ({item.status === "available" ? "available now" : "planned"})</span>
              {plan.available && item.status !== "available" && <span className="ml-1.5 text-xs">· planned</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {plan.available ? (
          <StartFreeButton size="md" label="Start visualising — Free" />
        ) : (
          // Deliberately not a button or link: there is nothing to buy yet.
          <p className="rounded-input bg-muted px-4 py-3 text-sm text-muted-foreground">
            Not available yet. There is no checkout, and nothing to subscribe to.
          </p>
        )}
      </div>
    </li>
  );
}

export function PricingCards() {
  return (
    <ul className="grid gap-5 lg:grid-cols-3" aria-label="Plans">
      {PLANS.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </ul>
  );
}
