/**
 * Copyright © 2026 BrainEno. 保留所有权利。
 *
 * 本文件及其包含的代码、设计和逻辑均为 BrainEno 的原创作品。
 * 未经作者明确书面授权，禁止复制、修改、分发或用于其他项目。
 *
 * 授权申请：nodeman24@outlook.com
 * 详见：LICENSE, TERMS.md
 */
"use client";

import { memo, type CSSProperties } from "react";
import TvShowreel from "./TvShowreel";
import { Img } from "./Img";
import { asset } from "../seo/asset";
import { t } from "../content/normalize";
import type { Language, PortfolioContent } from "../content/types";
import { cx } from "./cx";
import { PhoneBoothModel } from "./PhoneBoothModel";

type SectionProps<K extends keyof PortfolioContent> = {
  lang: Language;
  content: PortfolioContent[K];
};

export const Hero = memo(function Hero({ lang, content, name }: SectionProps<"hero"> & { name: string }) {
  const zh = lang === "zh";
  return (
    <section id="intro" className="hero" aria-label={name}>
      <h1 className="sr-only">{name}</h1>
      <div className="hero-box">
        {content.headlines.map((headline, index) => (
          <div key={index} className={cx("hero-word", `hero-word-${index + 1}`, zh && "is-zh")}>
            <span className="hero-word-mask">
              <span className="hero-word-text">{t(headline, lang)}</span>
            </span>
          </div>
        ))}
        {[1, 2].map((bar) => (
          <div key={bar} className={`hero-bar hero-bar-${bar}`} aria-hidden="true">
            {/* A 6vw strip. `lazy` keeps Next from emitting a second
                `<link rel=preload>` for the same picture at a different width —
                the hero photo below is the one worth a round trip. */}
            <Img
              className="hero-bar-image"
              src={content.image.src}
              alt=""
              sizes="6vw"
              loading="lazy"
              draggable={false}
              hidden
            />
          </div>
        ))}
        <div className="hero-photo-box">
          <div className="hero-photo-reveal">
            <div className="hero-photo-zoom">
              <Img
                className="hero-photo"
                src={content.image.src}
                alt={t(content.image.alt, lang)}
                sizes="(max-width: 767px) 56vw, 45vw"
                priority
                draggable={false}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

export const Journey = memo(function Journey({ lang, content }: SectionProps<"intro">) {
  const zh = lang === "zh";
  return (
    <section className="journey" aria-label={t(content.heading, lang)}>
      <div className="story-layer">
        <div className="story-visual">
          <div className="story-title">
            <h2 className={cx("story-title-text", zh && "is-zh")}>{t(content.heading, lang)}</h2>
          </div>
          <div className="story-photo-box">
            <div className="story-photo-ghost" aria-hidden="true">
              <Img src={content.portrait.src} alt="" sizes="(max-width: 767px) 40vw, 20vw" loading="lazy" hidden />
            </div>
            <div className="story-photo-mask">
              <Img
                className="story-photo"
                src={content.portrait.src}
                alt={t(content.portrait.alt, lang)}
                sizes="(max-width: 767px) 40vw, 20vw"
                loading="lazy"
              />
            </div>
            {t(content.portraitCredit, lang) ? (
              <div className="story-credit" aria-hidden="true">
                <span>{t(content.portraitCredit, lang)}</span>
                <i className="story-credit-ball" />
              </div>
            ) : null}
          </div>
        </div>
        <div className="story-copy">
          <p className={cx("copy", zh && "is-zh")}>{t(content.primaryText, lang)}</p>
        </div>
      </div>

      <div className="rail-stage">
        <div className="rail">
          {content.gallery.map((image, index) => (
            <figure key={`${image.src}-${index}`} className="rail-item">
              <Img
                className="rail-image"
                src={image.src}
                alt={t(image.alt, lang)}
                sizes="(max-width: 767px) 72vw, 40vw"
                loading="lazy"
              />
            </figure>
          ))}
        </div>
      </div>

      <div className="coda">
        {content.accentImages.map((image, index) => (
          <Img
            key={`${image.src}-${index}`}
            className={`coda-pic coda-pic-${index + 1}`}
            src={image.src}
            alt={t(image.alt, lang)}
            sizes="(max-width: 767px) 30vw, 19vw"
            loading="lazy"
          />
        ))}
        <p className={cx("copy coda-text", zh && "is-zh")}>{t(content.secondaryText, lang)}</p>
      </div>
    </section>
  );
});

type WorksProps = SectionProps<"works"> & {
  phone: string;
  activeIndex: number;
  onPreview: (index: number) => void;
};

export function Works({ lang, content, phone, activeIndex, onPreview }: WorksProps) {
  const zh = lang === "zh";
  const active = activeIndex >= 0 ? content.items[activeIndex] : undefined;
  const { screen, width, height, src, alphaSrc } = content.tv;
  const tvStyle = {
    "--tv-ratio": `${width} / ${height}`,
    "--tv-aspect": `${width / height}`,
    "--screen-top": `${screen.top}%`,
    "--screen-left": `${screen.left}%`,
    "--screen-width": `${screen.width}%`,
    "--screen-height": `${screen.height}%`,
    "--screen-cx": `${screen.left + screen.width / 2}%`,
    "--screen-cy": `${screen.top + screen.height / 2}%`,
  } as CSSProperties;

  return (
    <section id="works" className="works" aria-label={t(content.heading, lang)}>
      <div className="tv-stage">
        <div className="tv-anchor" style={tvStyle}>
          <div className="tv-box">
            {/* Base television photograph (`tv.webp`): rendered untouched whenever
                no work is hovered and again once the works list scrolls past into
                the `@BrainEno` zoom & opacity exit. */}
            <Img
              className="tv-frame"
              src={src}
              alt=""
              sizes="150vh"
              hidden
              loading="lazy"
              draggable={false}
              width={width}
              height={height}
            />
            <TvShowreel
              active={
                active
                  ? {
                      id: active.id,
                      src: active.image.src,
                      alt: active.image.alt,
                      videoSrc: active.video?.src,
                      videoPoster: active.video?.poster,
                    }
                  : null
              }
              alphaSrc={alphaSrc || src}
              frameWidth={width}
              frameHeight={height}
              label={(text) => t(text, lang)}
            />
            <div className="tv-number-layer" aria-hidden="true">
              <div className="tv-number">{phone}</div>
            </div>
            {/* Channel number flashed in the tube's corner after each change. */}
            <div className="tv-osd-layer" aria-hidden="true">
              {active ? (
                <span key={active.id} className="tv-osd">
                  CH {String(activeIndex + 1).padStart(2, "0")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="tv-seam" aria-hidden="true" />
        <div className="tv-scrim" aria-hidden="true" />
        <div className="tv-tune" aria-hidden="true">
          <span className="tv-tune-noise" />
          <span className="tv-tune-bar" />
        </div>
        <div className="tv-whiteout" aria-hidden="true" />
      </div>

      <div className="works-list">
        <h2 className="works-heading">
          <span className={cx("works-heading-text", zh && "is-zh")}>
            {t(content.heading, lang)} <span className="works-period">{content.period}</span>
          </span>
        </h2>
        <ol
          className="work-rows"
          onMouseLeave={(event) => {
            if (!(event.relatedTarget as Element | null)?.closest?.(".tv-video")) {
              onPreview(-1);
            }
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              onPreview(-1);
            }
          }}
        >
          {content.items.map((work, index) => {
            const title = t(work.title, lang);
            return (
              <li
                key={work.id}
                className={cx("work-row", zh && "is-zh", index === activeIndex && "is-active")}
                data-cursor="view"
                data-work-index={index}
                tabIndex={0}
                onMouseEnter={() => onPreview(index)}
                onFocus={() => onPreview(index)}
                onClick={() => onPreview(index)}
              >
                <span className="work-row-line" aria-hidden="true" />
                <span className="work-row-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className="work-row-mask">
                  <span className="work-row-title">
                    <span className="work-row-name">{title}</span>
                    <span className="work-row-name-alt" aria-hidden="true">{title}</span>
                  </span>
                </span>
                <span className="work-row-meta">
                  <span className="work-row-mask"><span>{work.year}</span></span>
                  <span className="work-row-mask" aria-hidden="true"><span>/</span></span>
                  <span className="work-row-mask"><span>{t(work.credit, lang)}</span></span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="tv-phone-spacer" aria-hidden="true" />
      <div className="tv-exit-spacer" aria-hidden="true" />
    </section>
  );
}

const MARQUEE_REPEAT = Array.from({ length: 4 }, (_, i) => i);

/** "MARQUEE MOON" -> "Marquee Moon" for the serif band; mixed-case or CJK copy is left as written. */
function softCase(text: string) {
  if (/[a-z]/.test(text) || !/[A-Z]/.test(text)) return text;
  return text.toLowerCase().replace(/(^|\s)(\S)/g, (_, space: string, char: string) => space + char.toUpperCase());
}

/**
 * The uploaded telephone model, optimised to a 2 MB GLB by
 * `scripts/optimize-booth-model.py` (the original 38 MB .gltf stays in the
 * repository as the source of truth). It replaces the cutout photo, which is
 * kept underneath as the pre-WebGL / no-WebGL state.
 */
const BOOTH_MODEL_SRC = asset("/gltfs/telephone.glb");

function ContactBooth({ fallback, plateText }: { fallback: string; plateText: string }) {
  return (
    <div className="contact-booth" aria-hidden="true">
      <span className="contact-booth-shadow" />
      <div className="contact-booth-float">
        {/* Drag rotates the model; the scroll timeline drives `.contact-booth`. */}
        <PhoneBoothModel src={BOOTH_MODEL_SRC} fallback={fallback} plateText={plateText} />
      </div>
    </div>
  );
}

export const Contact = memo(function Contact({ lang, content }: SectionProps<"contact">) {
  const zh = lang === "zh";
  const mailto = `mailto:${content.email}`;
  // `phone` doubles as a short contact handle: dial it when it holds digits,
  // otherwise link out to the profile configured in the credit block.
  const dialable = /\d{3}/.test(content.phone);
  const handleHref = dialable ? `tel:${content.phone.replace(/[^\d+]/g, "")}` : content.credit.url;
  const handleExternal = !dialable;
  const marquee = t(content.marquee, lang);
  // The call sign runs as two counter-scrolling bands behind the booth: every
  // line but the last in the grotesk, the last ("MARQUEE MOON") in the serif.
  // Booth and type share one size variable, so no JS measuring is needed.
  const lines = content.headlines.filter(Boolean);
  const bands = lines.length > 1 ? [lines.slice(0, -1).join(" "), softCase(lines[lines.length - 1])] : lines;

  return (
    <section id="contact" className="contact">
      <div className="contact-inner">
        <div className="contact-topbar">
          <span>
            <span className="contact-topbar-index">03</span>
            <span className={cx(zh && "is-zh")}>{zh ? "联系" : "Contact"}</span>
          </span>
          <span className={cx("contact-kicker-label", zh && "is-zh")}>
            {zh ? "独立设计与工程合作" : "Design & Engineering Inquiries"}
          </span>
        </div>

        <div className="contact-stage">
          <h2 className="sr-only">{lines.join(" ")}</h2>
          {/* Decorative repetition: hidden from the accessibility tree, the link
              borrows its name from the address it opens. */}
          <a href={mailto} className="contact-reel" data-cursor="link" aria-label={content.email}>
            {bands.map((band, row) => (
              <span key={row} className={`contact-reel-row contact-reel-row-${row + 1}`} aria-hidden="true">
                {[0, 1].map((track) => (
                  <span key={track} className="contact-reel-track">
                    {MARQUEE_REPEAT.map((i) => (
                      <span key={i} className="contact-reel-word">
                        {band}
                        <i className="contact-reel-dot" />
                      </span>
                    ))}
                  </span>
                ))}
              </span>
            ))}
          </a>
          <ContactBooth fallback={content.image.src} plateText={content.email} />
        </div>

        <div className="contact-cta">
          <div>
            <span className={cx("contact-cta-label", zh && "is-zh")}>{marquee}</span>
            <a href={mailto} className="contact-mail" data-cursor="link">
              <span className="contact-mail-mask">
                <span className="contact-mail-text">{content.email}</span>
              </span>
              <span className="contact-mail-arrow" aria-hidden="true">
                <span>↗</span>
              </span>
            </a>
          </div>
          <div className="contact-item">
            <span className={cx("contact-meta-label", zh && "is-zh")}>
              {dialable ? (zh ? "电话" : "Phone") : "GitHub"}
            </span>
            <a
              href={handleHref || "#contact"}
              className="contact-link contact-phone"
              data-cursor="link"
              {...(handleExternal ? { target: "_blank", rel: "noreferrer" } : {})}
            >
              <span>{content.phone}</span>
              {handleExternal ? <span className="contact-arrow" aria-hidden="true">↗</span> : null}
            </a>
          </div>
        </div>

        <div className="contact-footer">
          <p className="contact-copyright">{content.copyright}</p>
          {content.credit.name ? (
            <p className={cx("contact-credit", zh && "is-zh")}>
              {t(content.credit.prefix, lang)}{" "}
              <a href={content.credit.url} target="_blank" rel="noreferrer" className="contact-link contact-credit-link" data-cursor="link">
                <span>{content.credit.name}</span>
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
});
