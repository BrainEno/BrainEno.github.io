/**
 * Copyright © 2026 BrainEno. 保留所有权利。
 *
 * 本文件及其包含的代码、设计和逻辑均为 BrainEno 的原创作品。
 * 未经作者明确书面授权，禁止复制、修改、分发或用于其他项目。
 *
 * 授权申请：nodeman24@outlook.com
 * 详见：LICENSE, TERMS.md
 */
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter/wght.css";
import "@fontsource/inria-serif/latin-400.css";
import "@fontsource/inria-serif/latin-400-italic.css";
import "@fontsource/inria-serif/latin-700.css";
import { getSiteContent } from "@/portfolio/content/source";
import { htmlLang, pageTitle, pickText, siteUrl, shareImage } from "@/portfolio/seo/site";
import { asset } from "@/portfolio/seo/asset";
import PwaRegister from "@/portfolio/ui/PwaRegister";
import WaterHover from "@/portfolio/ui/WaterHover";
import "./globals.css";

// Fonts are self-hosted from the npm packages above, not fetched from Google:
// the build no longer needs the internet, the files ship with the site, and the
// static export works on any host (including offline / air-gapped previews).

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const lang = content.identity.defaultLanguage;
  const title = pageTitle(content);
  const description = pickText(content.identity.description, lang);
  const image = shareImage(content.hero.image.src, pickText(content.hero.image.alt, lang));
  return {
    metadataBase: siteUrl(),
    title: { default: title, template: `%s — ${pickText(content.identity.siteName, lang) || content.identity.name}` },
    description,
    applicationName: content.identity.name,
    authors: [{ name: content.identity.name }],
    creator: content.identity.name,
    keywords: [content.identity.name, ...content.works.items.map((w) => pickText(w.title, lang))],
    alternates: { canonical: "/" },
    manifest: "/manifest.webmanifest",
    // iOS takes the home-screen icon from this link, not from the manifest, and
    // search/social crawlers use it as the site's visual mark.
    icons: {
      icon: [{ url: asset("/icon.svg"), type: "image/svg+xml" }],
      apple: [{ url: asset("/icons/icon-192.png"), sizes: "192x192", type: "image/png" }],
      shortcut: [{ url: asset("/icons/icon-192.png") }],
    },
    appleWebApp: { capable: true, title: content.identity.name, statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
    openGraph: {
      type: "website",
      siteName: pickText(content.identity.siteName, lang) || content.identity.name,
      title,
      description,
      url: "/",
      locale: lang === "zh" ? "zh_CN" : "en_US",
      // The other language is the same URL, so `alternateLocale` is the honest
      // signal: cards pick the reader's language, crawlers still see one page.
      alternateLocale: lang === "zh" ? ["en_US"] : ["zh_CN"],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: content.identity.name,
      images: [image.url],
    },
    // `max-snippet`/`max-video-preview` widen what a search result may quote;
    // the defaults truncate the description on some engines.
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const content = await getSiteContent();
  return (
    <html lang={htmlLang(content.identity.defaultLanguage)} suppressHydrationWarning>
      <body>
        {/* The page opens at the masthead. Browsers otherwise restore the
            previous scroll position on a reload, which drops the reader
            straight into the intro before the hero has ever been seen — the
            smoother then pauses there and the loader plays over the wrong
            frame. Runs while the body is still parsing, so nothing is painted
            at the restored offset first.

            Two navigations keep their position: a deep link (hash) and going
            *back* to the page, which the reader expects to land where they
            left the index. `data-boot` tells the portfolio that the reset
            happened, so it only re-asserts the top when it did. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var n=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0];if(!location.hash&&!(n&&n.type==="back_forward")&&"scrollRestoration"in history){history.scrollRestoration="manual";window.scrollTo(0,0);document.documentElement.setAttribute("data-boot","top")}}catch(e){}',
          }}
        />
        {children}
        <PwaRegister />
        <WaterHover />
      </body>
    </html>
  );
}
