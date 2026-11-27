import { cn } from "@/lib/utils/cn";

/**
 * The approved VIZORA mark (public/brand/vizora-logo.svg): two wings. Paths and
 * the right-wing colour are exactly as supplied; the left wing reads
 * --brand-ink so it stays visible in dark mode (#202B27 light, #E7E0D6 dark).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 134 128"
      className={cn("h-8 w-auto shrink-0", className)}
      role="img"
      aria-label="Vizora"
      focusable="false"
      fill="none"
    >
      <path
        className="fill-(--brand-ink)"
        d="M25.1456 0H8.52703C1.91617 0 -2.17249 7.19237 1.21838 12.8567L70.1472 128L84.5294 93.0691C85.5273 90.6455 85.3492 87.8979 84.0467 85.6228L39.9299 8.56355C36.8983 3.26807 31.2562 0 25.1456 0Z"
      />
      <path
        d="M134 0H91.6927C78.6961 0 70.4906 13.9469 76.8221 25.2756L97.7225 62.6722L134 0Z"
        fill="#D4A615"
      />
    </svg>
  );
}

/**
 * The mark and wordmark. With `tagline`, the line sits directly beneath the
 * wordmark (not beneath the whole lockup), left-aligned with the "V".
 */
export function Logo({ className, showWordmark = true, tagline }: { className?: string; showWordmark?: boolean; tagline?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={tagline ? "h-9" : undefined} />
      {showWordmark && (
        <span className="grid">
          <span className="font-display text-2xl leading-none text-foreground">Vizora</span>
          {tagline && <span className="mt-1 text-[11px] leading-none tracking-wide text-muted-foreground">{tagline}</span>}
        </span>
      )}
    </span>
  );
}
