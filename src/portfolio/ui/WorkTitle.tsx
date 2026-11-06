"use client";

import { useEffect, useRef } from "react";

/** Match cap height and advance width before rolling between sans and serif. */
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

      const metrics = (style: CSSStyleDeclaration) => {
        const label = style.textTransform === "uppercase" ? text.toUpperCase() : text;

        /*
         * Canvas must see the same style and case as the rendered row. This
         * matters now that the alternate is a real serif rather than another
         * sans weight.
         */
        ctx.font = `${style.fontStyle} ${style.fontWeight} 100px ${style.fontFamily}`;

        const parsedSpacing = parseFloat(style.letterSpacing);
        const layerFontSize = parseFloat(style.fontSize);

        /*
         * Computed letter-spacing is an absolute px value derived from this
         * layer's own font-size, including --work-fit and, for the serif,
         * --work-cap. Normalise against that layer size rather than the
         * root's --work-size.
         */
        const spacing =
          Number.isFinite(parsedSpacing) &&
          Number.isFinite(layerFontSize) &&
          layerFontSize > 0
            ? (parsedSpacing * 100) / layerFontSize
            : 0;
        const glyphCount = Array.from(label).length;
        const advance = ctx.measureText(label).width + Math.max(0, glyphCount - 1) * spacing;

        return {
          cap: ctx.measureText(cjk ? "田" : "H").actualBoundingBoxAscent || 72,
          width: advance,
        };
      };

      const first = metrics(a);
      const second = metrics(b);

      const cap = Math.min(1.18, Math.max(0.88, first.cap / Math.max(1, second.cap)));

      const widthA = first.width;
      const widthB = second.width * cap;

      /*
       * A restrained horizontal correction keeps the serif exchange within the
       * original title column. It is not a scale-to-fit of the whole row and
       * does not alter the television or metadata columns.
       */
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