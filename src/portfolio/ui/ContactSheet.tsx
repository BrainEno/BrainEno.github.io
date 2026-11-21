"use client";

import { useRef, useState } from "react";
import type { Language, LocalizedText, PortfolioContent } from "../content/types";
import { t } from "../content/normalize";
import { Img } from "./Img";

const frame = (index: number) => String(index + 1).padStart(2, "0");

export function ContactSheet({ images, title, lang }: {
  images: PortfolioContent["intro"]["gallery"];
  title?: LocalizedText;
  lang: Language;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, select] = useState<number | null>(null);
  const image = selected === null ? null : images[selected];
  const zh = lang === "zh";
  const step = (delta: number) => select(i => ((i ?? 0) + delta + images.length) % images.length);
  if (!images.length) return null;

  return (
    <div className="proof-stage">
      <section className="proof-sheet" aria-labelledby="proof-heading">
        <header className="proof-head">
          <div><p className="proof-id">{t(title, lang) || (zh ? "简介相册" : "Intro gallery")}　/　VOL. 01</p>
            <h3 id="proof-heading">{zh ? "接触印样" : "Contact sheet"}</h3></div>
          <p className="proof-instruction">{zh ? "点一格，读选片笔记" : "Open a frame for the selection note"} ↗</p>
        </header>
        <div className="proof-grid">
          {images.map((item, i) => (
            <button key={`${item.src}-${i}`} type="button" className="proof-frame" aria-haspopup="dialog"
              onMouseDown={event => {
                // Native focus scrolling fights the transform on the pinned sheet.
                if (event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.focus({ preventScroll: true });
              }}
              onClick={() => { select(i); dialog.current?.showModal(); }}>
              <span className="proof-mount"><Img className="proof-image" src={item.src} alt={t(item.alt, lang)}
                sizes="(max-width: 700px) 44vw, (max-width: 1200px) 30vw, 360px" loading="eager" /></span>
              <span className="proof-caption"><b>{frame(i)}</b><span aria-hidden="true">{t(item.alt, lang)}</span><i aria-hidden="true">↗</i></span>
            </button>
          ))}
        </div>
      </section>
      <dialog className="proof-dialog" ref={dialog} aria-labelledby="proof-title" onClose={() => select(null)}
        onKeyDown={e => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); step(e.key === "ArrowLeft" ? -1 : 1); }
        }}>
        <div className="proof-tools"><span>{t(title, lang)}　/　{selected !== null && frame(selected)} — {frame(images.length - 1)}</span>
          <button type="button" onClick={() => dialog.current?.close()}>{zh ? "收起" : "Close"} ×</button></div>
        {image && <div className="proof-reading" aria-live="polite">
          <Img src={image.src} alt={t(image.alt, lang)} sizes="(max-width: 700px) 90vw, 68vw" water={false} />
          <div className="proof-margin"><p className="proof-id">{zh ? "选片笔记" : "Selection note"}　/　{frame(selected!)}</p>
            <h3 id="proof-title">{t(image.alt, lang)}</h3>
            {image.note && <p>{t(image.note, lang)}</p>}
            <nav aria-label={zh ? "浏览印样" : "Browse frames"}><button onClick={() => step(-1)} aria-label={zh ? "上一格" : "Previous frame"}>←</button>
              <button onClick={() => step(1)} aria-label={zh ? "下一格" : "Next frame"}>→</button></nav>
          </div>
        </div>}
      </dialog>
    </div>
  );
}
