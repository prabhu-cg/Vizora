import type { MetadataRoute } from "next";
import { MARKETING_ROUTES } from "@/lib/marketing/routes";
import { absoluteUrl } from "@/lib/site";

/** Marketing pages only; the application under /app is not indexed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(MARKETING_ROUTES).map((r) => ({
    url: absoluteUrl(r.path),
    changeFrequency: "monthly",
    priority: r.priority,
  }));
}
