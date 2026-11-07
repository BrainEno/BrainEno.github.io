import type { MetadataRoute } from "next";
import { siteUrl } from "@/portfolio/seo/site";
import { BASE_PATH } from "@/portfolio/seo/asset";

/**
 * `output: "export"` only accepts metadata routes that can be prerendered at
 * build time; declaring the empty params set is what tells the exporter that
 * this one is buildable (there is nothing to enumerate — it is a single file).
 */
export function generateStaticParams() {
  return [];
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = siteUrl().toString().replace(/\/$/, "");
  // The offline shell is a PWA fallback, not a page: keep it out of the index
  // for every crawler. The named agents are the ones that matter for a
  // mainland-China audience — an explicit rule costs nothing and removes any
  // doubt about the wildcard when a market-specific crawler is conservative.
  const rules = [
    { userAgent: "*", allow: "/", disallow: [`${BASE_PATH}/offline`] },
    { userAgent: "Baiduspider", allow: "/", disallow: [`${BASE_PATH}/offline`] },
    { userAgent: "Sogou web spider", allow: "/", disallow: [`${BASE_PATH}/offline`] },
    { userAgent: "360Spider", allow: "/", disallow: [`${BASE_PATH}/offline`] },
    { userAgent: "Bytespider", allow: "/", disallow: [`${BASE_PATH}/offline`] },
  ];
  return {
    rules,
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
