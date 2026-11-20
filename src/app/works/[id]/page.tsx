import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteContent } from "@/portfolio/content/source";
import { WorkDetail } from "@/portfolio/ui/WorkDetail";
import { pickText, shareImage, siteUrl } from "@/portfolio/seo/site";
import "@/portfolio/styles/work-detail.css";

/**
 * Every project page is prerendered in a static build, so the export needs the
 * complete list up front; the server build keeps answering per request, so the
 * list is not consulted there.
 */
export async function generateStaticParams() {
  const content = await getSiteContent();
  return content.works.items.map((work) => ({ id: work.id }));
}

type Params = { params: Promise<{ id: string }> };

async function findWork(id: string) {
  const content = await getSiteContent();
  const work = content.works.items.find((item) => item.id === id);
  return { content, work };
}

/**
 * Normalise the free-form `year` label for JSON-LD `dateCreated`:
 * "2026.04.22" → "2026-04-22", "2026" stays "2026", anything looser ("—")
 * becomes `undefined` so the field is omitted instead of emitted as junk.
 */
function isoDateLabel(label: string): string | undefined {
  const trimmed = label.trim();
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  const dotted = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (dotted) {
    const [, year, month, day] = dotted;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return undefined;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const { content, work } = await findWork(id);
  if (!work) return { title: "Not found", robots: { index: false } };
  const lang = content.identity.defaultLanguage;
  const title = pickText(work.title, lang);
  const description = pickText(work.description, lang);
  const imageSrc = work.image.src || content.hero.image.src;
  const imageAlt = pickText((work.image.src ? work.image : content.hero.image).alt, lang) || title;
  // Largest WebP rung with its real dimensions, not the multi-megabyte original:
  // a link paste into a messenger should render a card, not time out.
  const image = shareImage(imageSrc, imageAlt);
  return {
    title,
    description,
    alternates: { canonical: `/works/${work.id}/` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/works/${work.id}/`,
      locale: lang === "zh" ? "zh_CN" : "en_US",
      alternateLocale: lang === "zh" ? ["en_US"] : ["zh_CN"],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}

/** Static-prerendered project page: crawlable detail copy + detail images. */
export default async function WorkPage({ params }: Params) {
  const { id } = await params;
  const { content, work } = await findWork(id);
  if (!work) notFound();
  const lang = content.identity.defaultLanguage;
  // The cover opens the page and detailImages are *additional* stills: if the
  // contents repeat the cover as detailImages[0] (the old template did that
  // for every work), render each distinct source exactly once (#74).
  const images = [work.image, ...work.detailImages].filter(
    (image, index, all) => image.src && all.findIndex((other) => other.src === image.src) === index,
  );
  const origin = siteUrl().toString().replace(/\/$/, "");
  const title = pickText(work.title, lang);
  const share = images[0] ? shareImage(images[0].src, pickText(images[0].alt, lang) || title) : undefined;
  // Two nodes: the trail the reader walked, and the work itself as a
  // `CreativeWork` with its author and dates — the shape search engines expect
  // for a portfolio entry, and the one that survives a no-JS crawl.
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: content.identity.name, item: `${origin}/` },
          { "@type": "ListItem", position: 2, name: title, item: `${origin}/works/${work.id}/` },
        ],
      },
      {
        "@type": "CreativeWork",
        "@id": `${origin}/works/${work.id}/#work`,
        name: title,
        description: pickText(work.description, lang),
        url: `${origin}/works/${work.id}/`,
        // Schema.org wants ISO 8601; the content field is a loose display
        // label ("2026.04.22", "2026", "—"). Normalise what is parseable and
        // omit the rest rather than emitting junk a parser would choke on.
        dateCreated: isoDateLabel(work.year),
        inLanguage: lang === "zh" ? "zh-Hans" : "en",
        image: share ? { "@type": "ImageObject", url: share.url, width: share.width, height: share.height } : undefined,
        creator: { "@type": "Person", name: content.identity.name, url: `${origin}/` },
        isPartOf: { "@type": "WebSite", name: pickText(content.identity.siteName, lang) || content.identity.name, url: `${origin}/` },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }}
      />
      <WorkDetail work={work} images={images} identity={content.identity} />
    </>
  );
}
