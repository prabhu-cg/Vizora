import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

/** Per-page metadata with canonical URL, Open Graph and Twitter cards (the social image is inherited from app/opengraph-image). */
export function pageMetadata({
  title,
  absoluteTitle,
  description,
  path,
}: {
  title?: string;
  absoluteTitle?: string;
  description: string;
  path: string;
}): Metadata {
  const shown = absoluteTitle ?? (title ? `${title} · ${SITE_NAME}` : SITE_NAME);
  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, title: shown, description, url: path, locale: "en_GB" },
    twitter: { card: "summary_large_image", title: shown, description },
  };
}
