/**
 * Copyright © 2026 BrainEno. 保留所有权利。
 *
 * 本文件及其包含的代码、设计和逻辑均为 BrainEno 的原创作品。
 * 未经作者明确书面授权，禁止复制、修改、分发或用于其他项目。
 *
 * 授权申请：nodeman24@outlook.com
 * 详见：LICENSE, TERMS.md
 */
import type { Language, PortfolioContent } from "../content/types";
import manifest from "../content/image-manifest.json";
import { asset } from "./asset";

/**
 * Canonical origin of the site, baked in at build time.
 *
 * A static host cannot read env vars per request, so `NEXT_PUBLIC_SITE_URL`
 * (or `SITE_URL`) must be set when building for deployment. The host-provided
 * fallbacks are second best — Netlify sets `URL`, GitHub Pages users usually set
 * the variable — and localhost is only for local builds.
 */
export function siteUrl(): URL {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.URL || // Netlify
    process.env.DEPLOY_PRIME_URL || // Netlify deploy previews
    process.env.CF_PAGES_URL || // Cloudflare Pages (static)
    "http://localhost:3000";
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const htmlLang = (lang: Language) => (lang === "zh" ? "zh-Hans" : "en");

export function pickText(value: { zh: string; en: string } | undefined, lang: Language) {
  return (value?.[lang] || value?.[lang === "zh" ? "en" : "zh"] || "").trim();
}

/**
 * Public absolute URL for a content-owned or site-relative asset (`og:image`,
 * `twitter:image`, JSON-LD `image`).
 *
 * Root-absolute content paths (`/images/...`) are passed through `asset()`
 * first so sub-path deployments (`/<repo>/`) keep their mount prefix instead
 * of resolving against the bare domain root.
 */
export function absoluteUrl(src: string) {
  const base = siteUrl();
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  if (!src) return base.toString();
  try {
    return new URL(asset(src), base).toString();
  } catch {
    return base.toString();
  }
}

/**
 * The picture a link preview should actually show.
 *
 * `og:image` used to point at the *original* upload — a 1.9 MB PNG. Every
 * messenger that renders a card (WeChat, Slack, X, Telegram) then either
 * downsamples it after downloading the whole thing or gives up and shows no
 * preview, which is exactly the wrong outcome on a phone in a slow network.
 *
 * The responsive ladder already contains a WebP of that same picture at a
 * share-friendly size, so the card points at the widest rung and declares its
 * dimensions and type: scrapers that understand `og:image:width/height` can lay
 * the card out before the bytes arrive, and nothing new has to be generated.
 */
export function shareImage(src: string, fallbackAlt = "") {
  const entry = (manifest as { images: Record<string, { width: number; height: number; variants: { type: string; srcSet: string }[] }> }).images[src];
  const candidates =
    entry?.variants
      .find((variant) => variant.type === "image/webp")
      ?.srcSet.split(",")
      .map((candidate) => {
        const [url, descriptor] = candidate.trim().split(/\s+/);
        return { url, width: Number(descriptor?.replace("w", "")) || entry.width };
      })
      .filter((candidate) => Number.isFinite(candidate.width)) ?? [];
  if (!candidates.length || !entry) {
    return { url: absoluteUrl(src), width: entry?.width, height: entry?.height, type: undefined, alt: fallbackAlt };
  }
  const widest = candidates.reduce((best, candidate) => (candidate.width > best.width ? candidate : best), candidates[0]);
  return {
    url: absoluteUrl(widest.url),
    width: widest.width,
    height: Math.round((widest.width * entry.height) / entry.width),
    type: "image/webp",
    alt: fallbackAlt,
  };
}

export function pageTitle(content: PortfolioContent) {
  const lang = content.identity.defaultLanguage;
  const title = pickText(content.identity.pageTitle, lang) || content.identity.name;
  const site = pickText(content.identity.siteName, lang);
  return site && site !== title ? `${title} — ${site}` : title;
}

/** schema.org graph (Person + WebSite + one CreativeWork per project). */
export function jsonLd(content: PortfolioContent) {
  const lang = content.identity.defaultLanguage;
  const origin = siteUrl().toString().replace(/\/$/, "");
  const description = pickText(content.identity.description, lang);
  const sameAs = [content.contact.credit.url].filter((url) => /^https?:\/\//.test(url));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: `${origin}/`,
        name: pickText(content.identity.siteName, lang) || content.identity.name,
        description,
        inLanguage: htmlLang(lang),
      },
      {
        "@type": "Person",
        "@id": `${origin}/#person`,
        name: content.identity.name,
        description,
        url: `${origin}/`,
        image: absoluteUrl(content.hero.image.src),
        email: content.contact.email ? `mailto:${content.contact.email}` : undefined,
        sameAs,
      },
      ...content.works.items.map((work) => {
        const workImage = work.image.src || content.hero.image.src;
        return {
          "@type": "CreativeWork",
          "@id": `${origin}/works/${work.id}/`,
          name: pickText(work.title, lang),
          description: pickText(work.description, lang),
          image: workImage ? absoluteUrl(workImage) : undefined,
          url: `${origin}/works/${work.id}/`,
          dateCreated: work.year,
          creator: { "@id": `${origin}/#person` },
        };
      }),
    ],
  };
}
