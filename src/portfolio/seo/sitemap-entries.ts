import type { MetadataRoute } from "next";
import type { Work } from "../content/types";
import { modifiedDate } from "../content/modified-date";

export function sitemapEntries(origin: string, works: Work[], lastModified?: string): MetadataRoute.Sitemap {
  return [
    { url: `${origin}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    ...works.map((work) => ({
      // `trailingSlash: true` makes `/works/<id>/` the canonical address, so
      // the sitemap must not advertise the extensionless form (GitHub Pages
      // would answer it with a 301, which wastes a crawl).
      url: `${origin}/works/${work.id}/`,
      lastModified: modifiedDate(work.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
