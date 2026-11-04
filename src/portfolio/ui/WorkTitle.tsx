"use client";

import { useEffect, useRef } from "react";

/** Match cap height and advance width before rolling between the two faces. */
export function WorkTitle({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const cjk = /[\u3400-\u9fff]/.test(text);

  useEffect(() => {
    const root = ref.current;
    const normal = root?.querySelector<HTMLElement>(".work-row-name");
    const alternate = root?.querySelector<HTMLElement>(".work-row-name-alt");
    if (!root || !normal || !alternate) return;
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return;
    let disposed = false;
    let frame = 0;
    const measure = () => {
      if (disposed) return;
      const size = parseFloat(getComputedStyle(root).fontSize);
      const a = getComputedStyle(normal);
      const b = getComputedStyle(alternate);
      const label = text.toUpperCase();
      const metrics = (style: CSSStyleDeclaration) => {
        ctx.font = `${style.fontWeight} 100px ${style.fontFamily}`;
        return { cap: ctx.measureText(cjk ? "田" : "H").actualBoundingBoxAscent || 72, width: ctx.measureText(label).width };
      };
      const first = metrics(a);
      const second = metrics(b);
      const cap = Math.min(1.18, Math.max(0.88, first.cap / second.cap));
      const spacing = (label.length - 1) * -2.5;
      const widthA = first.width + spacing;
      const widthB = (second.width + spacing) * cap;
      const tracking = Math.min(1.16, Math.max(0.86, widthA / Math.max(1, widthB)));
      const available = root.clientWidth - size * 0.1;
      const fit = Math.min(1, available / (Math.max(widthA, widthB * tracking) * size / 100));
      root.style.setProperty("--work-fit", String(fit));
      root.style.setProperty("--work-cap", String(cap));
      root.style.setProperty("--work-width", String(tracking));
    };
    const schedule = () => {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    document.fonts.addEventListener("loadingdone", schedule);
    void document.fonts.ready.then(schedule);
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", schedule);
    };
  }, [text, cjk]);

  return (
    <span ref={ref} className="work-row-title" data-script={cjk ? "cjk" : "latin"}>
      <span className="work-row-name"><span className="work-row-ink">{text}</span></span>
      <span className="work-row-name-alt" aria-hidden="true"><span className="work-row-ink">{text}</span></span>
    </span>
  );
}