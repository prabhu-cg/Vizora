export const SITE_NAME = "Vizora";
export const TAGLINE = "See beyond information";
export const SITE_DESCRIPTION =
  "Vizora is a local-first universal visualisation platform. Turn ideas, information and data into diagrams and charts you can explore, edit and export.";

/**
 * Canonical origin, from configuration only (never hardcoded):
 *  1. NEXT_PUBLIC_SITE_URL (set this to the production domain)
 *  2. Vercel's production/deployment URL
 *  3. http://localhost:3000 for local development
 */
export function getSiteUrl(env: Record<string, string | undefined> = process.env): URL {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit);
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

/** Optional public contact address; legal pages show it only when configured. */
export function getContactEmail(env: Record<string, string | undefined> = process.env): string | undefined {
  const v = env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return v || undefined;
}

export function absoluteUrl(path: string, env?: Record<string, string | undefined>): string {
  return new URL(path, getSiteUrl(env)).toString();
}
