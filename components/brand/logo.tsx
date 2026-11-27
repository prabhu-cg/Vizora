import { cn } from "@/lib/utils/cn";

/**
 * PLACEHOLDER BRAND MARK. No approved VIZORA logo assets were supplied with
 * this build. Replace the SVG below (and app/icon.svg) with the approved
 * assets; see public/brand/README.md. All callers go through this component,
 * so it is the only place to change.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      role="img"
      aria-label="VIZORA"
      focusable="false"
    >
      <defs>
        <linearGradient id="vz-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2878F0" />
          <stop offset="1" stopColor="#8055E8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#vz-grad)" />
      <path d="M9 10l7 13 7-13" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="9" r="2.2" fill="#16C7D9" />
    </svg>
  );
}

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showWordmark && <span className="text-lg font-bold tracking-[0.12em] text-navy">VIZORA</span>}
    </span>
  );
}
