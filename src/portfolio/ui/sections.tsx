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
import { WorkTitle } from "./WorkTitle";

type SectionProps<K extends keyof PortfolioContent> = {
  lang: Language;
  content: PortfolioContent[K];
};

export const Hero = memo(function Hero({ lang, content, name }: SectionProps<"hero"> & { name: string }) {
  const zh = lang === "zh";
  return (
    <section id="intro" className="hero" aria-label={name}>
      {/* The masthead already carries the name in the header, so the hero keeps
          it for the document outline only. */}
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

/** Split copy into spans the scroll choreography can light up one by one.
 *  Latin text breaks on words; CJK text (no spaces) breaks after punctuation
 *  so each clause reads as a unit instead of a per-character flicker. */
export function Words({ text }: { text: string }) {
  const cjk = /[\u3400-\u9fff]/.test(text);
  const parts = cjk ? text.split(/(?<=[，。、；：！？—）」』])/) : text.split(/\s+/);
  return (
    <>
      {parts.filter(Boolean).map((part, index) => (
        <span key={index} className="copy-word">
          {part}
          {cjk ? "" : " "}
        </span>
      ))}
    </>
  );
}

/** First sentence of the biography becomes the lead, the rest the body. */
function splitLead(text: string): [string, string] {
  const match = text.match(/^(.+?[。！？]|.+?[.!?](?=\s))\s*([\s\S]*)$/);
  if (!match || !match[2]) return [text, ""];
  return [match[1].trim(), match[2].trim()];
}

type JourneyProps = SectionProps<"intro"> & { name: string };

export const Journey = memo(function Journey({ lang, content, name }: JourneyProps) {
  const zh = lang === "zh";
  const [lead, body] = splitLead(t(content.primaryText, lang));
  const heading = t(content.heading, lang);
  // The lead is set as a two-line lockup — the name, then the role — which is
  // what gives the block its hierarchy in both languages. The split is only
  // attempted when the sentence really opens with the name (or, failing that,
  // with a comma clause), so edited copy can never be cut mid-thought.
  const leadParts = (() => {
    if (lead.startsWith(name)) {
      const tail = lead.slice(name.length);
      const cut = name.length + (/^[，,]/.test(tail) ? 1 : 0);
      const rest = lead.slice(cut).trim();
      return rest ? ([lead.slice(0, cut).trim(), rest] as const) : null;
    }
    const comma = lead.search(/[，,]/);
    if (comma > 0) {
      const rest = lead.slice(comma + 1).trim();
      return rest ? ([lead.slice(0, comma + 1), rest] as const) : null;
    }
    return null;
  })();
  return (
    <section className="journey" aria-label={heading}>
      <div className="story-layer">
        <div className="story-visual">
          {/* Keep the document outline without a second visible label. */}
          <h2 className="sr-only">{heading}</h2>
          <div className="story-photo-box">
            <div className="story-photo-ghost" aria-hidden="true">
              <Img src={content.portrait.src} alt="" sizes="(max-width: 1023px) 72vw, 27vw" loading="lazy" hidden />
            </div>
            <div className="story-photo-mask">
              <Img
                className="story-photo"
                src={content.portrait.src}
                alt={t(content.portrait.alt, lang)}
                sizes="(max-width: 1023px) 72vw, 27vw"
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
          <div className="story-copy-inner">
            <p className={cx("copy copy-lead", zh && "is-zh")}>
              {leadParts ? (
                <>
                  <span className="copy-lead-name">{leadParts[0]}</span>
                  <span className="copy-lead-role"><Words text={leadParts[1]} /></span>
                </>
              ) : (
                <Words text={lead} />
              )}
            </p>
            {body ? (
              <p className={cx("copy copy-body", zh && "is-zh")}>
                <Words text={body} />
              </p>
            ) : null}
          </div>
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
                sizes="(max-width: 1023px) 78vw, 40vw"
                loading="lazy"
              />
              <figcaption className="rail-caption" aria-hidden="true">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>{String(content.gallery.length).padStart(2, "0")}</span>
              </figcaption>
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
            sizes="(max-width: 1023px) 44vw, 19vw"
            loading="lazy"
          />
        ))}
        <p className={cx("copy coda-text", zh && "is-zh")}>
          <Words text={t(content.secondaryText, lang)} />
        </p>
      </div>
    </section>
  );
});

/**
 * The call sign, drawn on the television's own glass: `@BrainEno` in phosphor
 * above the address, which types itself out behind a block caret. Positioned
 * and clipped to the screen (`.tv-msg-layer` uses the same --screen-* geometry
 * as the rest of the set), so both lines always sit inside the bezel of
 * `tv-alpha.webp`; type sizes are container units (cqi) for the same reason.
 */
export const TvMessage = memo(function TvMessage({ email }: { email: string }) {
  return (
    <div className="tv-msg-layer" aria-hidden="true">
      <div className="tv-msg-portal" />
      <div className="tv-msg-rig">
        <div className="tv-msg-raster" />
        <div className="tv-msg-flash" />
        <p className="tv-msg-handle">@BrainEno</p>
        <p className="tv-msg-mail">
          {Array.from(email).map((char, index) => (
            <span key={index} className="tv-msg-char">
              {char}
            </span>
          ))}
        </p>
      </div>
      <div className="tv-msg-static" />
    </div>
  );
});

type WorksProps = SectionProps<"works"> & {
  email: string;
  activeIndex: number;
  /** Index of the work opened in the theater, or -1 while browsing the index. */
  theaterIndex: number;
  /**
   * Work whose sheet is rendered. Equal to `theaterIndex` while screening, but
   * it outlives the theater by one exit animation so the copy can fade out
   * instead of being unmounted mid-transition.
   */
  sheetIndex: number;
  onPreview: (index: number) => void;
  onOpen: (index: number) => void;
  onClose: () => void;
  onStep: (delta: 1 | -1) => void;
};

export function Works({
  lang,
  content,
  email,
  activeIndex,
  theaterIndex,
  sheetIndex,
  onPreview,
  onOpen,
  onClose,
  onStep,
}: WorksProps) {
  const zh = lang === "zh";
  const active = activeIndex >= 0 ? content.items[activeIndex] : undefined;
  const featured = sheetIndex >= 0 ? content.items[sheetIndex] : undefined;
  const theaterOpen = theaterIndex >= 0;
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
          {/* The camera: `createDive` scales this wrapper about the middle of
              the screen until the glass covers the viewport. */}
          <div className="tv-zoom">
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
              autoplay={theaterOpen}
            />
            <TvMessage email={email} />
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
        </div>
        <div className="tv-seam" aria-hidden="true" />
        <div className="tv-scrim" aria-hidden="true" />
        <div className="tv-tune" aria-hidden="true">
          <span className="tv-tune-noise" />
          <span className="tv-tune-bar" />
        </div>
        {/* Theater: the room darkens around the set while a project plays. */}
        <div className="tv-theater-veil" aria-hidden="true" />
        <div
          className="tv-sheet"
          role="dialog"
          aria-modal={theaterOpen || undefined}
          aria-hidden={!theaterOpen || undefined}
          aria-label={featured ? t(featured.title, lang) : undefined}
        >
          {featured ? (
            <div className="tv-sheet-inner">
              {/* Only the project copy is keyed: switching works remounts this
                  block (and `TheaterHandle.swap` reveals it), while the nav
                  below stays mounted for the whole screening — it never loses
                  its visibility or the keyboard focus. */}
              <div key={featured.id} className="tv-sheet-content">
                <div className="tv-sheet-top">
                  <span className="tv-sheet-mask">
                    <span className="tv-sheet-reveal tv-sheet-index">
                      {String(sheetIndex + 1).padStart(2, "0")} / {String(content.items.length).padStart(2, "0")}
                    </span>
                  </span>
                  <span className="tv-sheet-mask">
                    <span className={cx("tv-sheet-reveal tv-sheet-kicker", zh && "is-zh")}>
                      {t(content.heading, lang)}
                    </span>
                  </span>
                </div>
                <h3 className="tv-sheet-title">
                  <span className="tv-sheet-mask">
                    <span className={cx("tv-sheet-reveal", /[\u3400-\u9fff]/.test(t(featured.title, lang)) && "is-zh")}>
                      {t(featured.title, lang)}
                    </span>
                  </span>
                </h3>
                <ul className="tv-sheet-meta">
                  <li className="tv-sheet-mask"><span className="tv-sheet-reveal">{featured.year}</span></li>
                  {t(featured.credit, lang)
                    .split("·")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <li key={tag} className="tv-sheet-mask">
                        <span className={cx("tv-sheet-reveal", zh && "is-zh")}>/ {tag}</span>
                      </li>
                    ))}
                </ul>
                <p className={cx("tv-sheet-fade tv-sheet-copy", zh && "is-zh")}>{t(featured.description, lang)}</p>
                <div className="tv-sheet-fade tv-sheet-actions">
                  <a href={featured.url} target="_blank" rel="noreferrer" className="tv-sheet-link" data-cursor="link">
                    <span>{zh ? "查看仓库" : "Open repository"}</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
              <nav
                className="tv-sheet-nav"
                aria-label={zh ? "项目切换" : "Project navigation"}
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  const button = (event.target as Element).closest<HTMLButtonElement>("button");
                  if (!button) return;
                  event.preventDefault();
                  button.focus({ preventScroll: true });
                }}
              >
                <button
                  type="button"
                  className="tv-sheet-btn"
                  onClick={() => onStep(-1)}
                  disabled={!theaterOpen}
                  aria-label={zh ? "上一个项目" : "Previous project"}
                  data-cursor="link"
                >
                  <span className="tv-sheet-btn-icon" aria-hidden="true">←</span>
                  <span className={cx("tv-sheet-btn-label", zh && "is-zh")}>{zh ? "上一个" : "Previous"}</span>
                </button>
                <button
                  type="button"
                  className="tv-sheet-btn"
                  onClick={() => onStep(1)}
                  disabled={!theaterOpen}
                  aria-label={zh ? "下一个项目" : "Next project"}
                  data-cursor="link"
                >
                  <span className={cx("tv-sheet-btn-label", zh && "is-zh")}>{zh ? "下一个" : "Next"}</span>
                  <span className="tv-sheet-btn-icon" aria-hidden="true">→</span>
                </button>
                <button
                  type="button"
                  className="tv-sheet-btn tv-sheet-close"
                  onClick={onClose}
                  disabled={!theaterOpen}
                  aria-label={zh ? "关闭放映，返回作品列表" : "Close and return to the works index"}
                  data-cursor="link"
                >
                  <span className={cx("tv-sheet-btn-label", zh && "is-zh")}>{zh ? "关闭" : "Close"}</span>
                  <span className="tv-sheet-btn-icon tv-sheet-btn-x" aria-hidden="true">×</span>
                </button>
              </nav>
            </div>
          ) : null}
        </div>
      </div>

      <div className="works-list">
        <h2 className="sr-only">{t(content.heading, lang)}</h2>
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
                onMouseEnter={() => onPreview(index)}
              >
                {/* One real control per row, covering it: the <ol>/<li> keep
                    their list semantics, the row is still announced as a
                    button, and its accessible name is the project title rather
                    than the year / credit line underneath. */}
                <button
                  type="button"
                  className="work-row-hit"
                  aria-haspopup="dialog"
                  onFocus={() => onPreview(index)}
                  // A mouse press would focus with the browser's default
                  // scroll-into-view, which runs against ScrollSmoother's
                  // transformed content and can move the row between
                  // pointerdown and pointerup — the click then lands on the
                  // list instead of the row and the theater never opens. Focus
                  // it ourselves, without scrolling.
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.currentTarget.focus({ preventScroll: true });
                  }}
                  onClick={() => onOpen(index)}
                >
                  <span className="sr-only">{title}</span>
                </button>
                <span className="work-row-line" aria-hidden="true" />
                <span className="work-row-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className="work-row-mask">
                  <WorkTitle text={title} />
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
      {/* The only spacer the set needs now: the exit runs over `#contact`'s
          own climb, so there is no second pinned gap to scroll through. */}
      <div className="tv-phone-spacer" aria-hidden="true" />
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
