import { sitemapEntries } from "@/portfolio/seo/sitemap-entries";
import type { MetadataRoute } from "next";
import { getContentUpdatedAt, getSiteContent } from "@/portfolio/content/source";
import { siteUrl } from "@/portfolio/seo/site";

/**
 * `output: "export"` only accepts metadata routes that can be prerendered at
 * build time; declaring the empty params set is what tells the exporter that
 * this one is buildable (there is nothing to enumerate — it is a single file).
 */
export function generateStaticParams() {
  return [];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getSiteContent();
  const origin = siteUrl().toString().replace(/\/$/, "");
  return sitemapEntries(origin, content.works.items, (await getContentUpdatedAt()) ?? undefined);
}
