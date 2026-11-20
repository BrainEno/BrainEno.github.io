"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { PortfolioContent, Work, MediaImage } from "../content/types";
import { t } from "../content/normalize";
import { Img } from "./Img";
import { ArrowIcon } from "./Arrow";
import { useLanguage } from "./useLanguage";

export function WorkDetail({ work, identity, images }: {
  work: Work; identity: PortfolioContent["identity"]; images: MediaImage[];
}) {
  const lang = useLanguage(identity.defaultLanguage);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
    document.title = `${t(work.title, lang)} — ${t(identity.siteName, lang) || identity.name}`;
  }, [lang, work.title, identity]);
  return (
    <main className="wd">
      <Link className="wd-back" href="/#works">← {identity.name}</Link>
      <header className="wd-head">
        <p className="wd-meta">{work.year} / {t(work.credit, lang)}</p>
        <h1 className="wd-title">{t(work.title, lang)}</h1>
      </header>
      <p className="wd-text">{t(work.description, lang)}</p>
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
            {/* Show the entire screenshot without changing the frame geometry. */}
            <Img
              src={image.src}
              alt={t(image.alt, lang) || t(work.title, lang)}
              sizes="(max-width: 767px) 92vw, (max-width: 1200px) 45vw, 540px"
              loading={index ? "lazy" : "eager"}
            />
          </figure>
        ))}
      </div>
    </main>
  );
}
