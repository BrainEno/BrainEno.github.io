import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteContent } from "@/portfolio/content/source";
import { Img } from "@/portfolio/ui/Img";
import { ArrowIcon } from "@/portfolio/ui/Arrow";
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
  const image = imageSrc ? shareImage(imageSrc, imageAlt) : undefined;
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
      images: image ? [image] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image.url] : undefined,
    },
  };
}

/** Static-prerendered project page: crawlable detail copy + detail images. */
export default async function WorkPage({ params }: Params) {
  const { id } = await params;
  const { content, work } = await findWork(id);
  if (!work) notFound();
  const lang = content.identity.defaultLanguage;
  const images = [work.image, ...work.detailImages].filter((image) => image.src);
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
        dateCreated: work.year,
        inLanguage: lang === "zh" ? "zh-Hans" : "en",
        image: share ? { "@type": "ImageObject", url: share.url, width: share.width, height: share.height } : undefined,
        creator: { "@type": "Person", name: content.identity.name, url: `${origin}/` },
        isPartOf: { "@type": "WebSite", name: pickText(content.identity.siteName, lang) || content.identity.name, url: `${origin}/` },
      },
    ],
  };

  return (
    <main className="wd">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }}
      />
      <Link className="wd-back" href="/#works">← {content.identity.name}</Link>
      <header className="wd-head">
        <p className="wd-meta">{work.year} / {pickText(work.credit, lang)}</p>
        <h1 className="wd-title">{pickText(work.title, lang)}</h1>
      </header>
      <p className="wd-text">{pickText(work.description, lang)}</p>
      {work.isPrivate ? (
        <p className="wd-access">
          {lang === "zh"
            ? "私有项目，源码暂不公开；本页仅展示项目说明与预览。"
            : "Private project. The source is not public; this page contains project notes and previews only."}
        </p>
      ) : work.url ? (
        <a
          className="wd-link"
          href={work.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {work.url.replace(/^https?:\/\//, "")} <ArrowIcon />
        </a>
      ) : null}
      <div className="wd-grid">
        {images.map((image, index) => (
          <figure key={`${image.src}-${index}`} className="wd-frame">
            {/* Fixed frame + object-fit: any aspect ratio can be uploaded. */}
            <Img
              src={image.src}
              alt={pickText(image.alt, lang) || pickText(work.title, lang)}
              sizes="(max-width: 767px) 92vw, (max-width: 1200px) 45vw, 540px"
              loading={index ? "lazy" : "eager"}
            />
          </figure>
        ))}
      </div>
    </main>
  );
}
