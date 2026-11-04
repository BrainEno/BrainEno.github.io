/**
 * Copyright © 2026 BrainEno. 保留所有权利。
 *
 * 本文件及其包含的代码、设计和逻辑均为 BrainEno 的原创作品。
 * 未经作者明确书面授权，禁止复制、修改、分发或用于其他项目。
 *
 * 授权申请：nodeman24@outlook.com
 * 详见：LICENSE, TERMS.md
 */
import { gsap } from "gsap";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * "Theater" beat for the works television.
 *
 * Clicking a row no longer just tunes the channel: the whole set pushes in
 * until the CRT glass fills the right half of the stage (the top half on
 * portrait screens), the index dissolves, and the project sheet slides in on
 * the left. Everything is derived from the same `--screen-*` rectangle the
 * rig already uses, so the zoom lands on the glass regardless of viewport.
 *
 * Geometry: `.tv-box` has `transform-origin: var(--screen-cx) var(--screen-cy)`
 * — the centre of the glass. Scaling about that point keeps the glass centre
 * still, so one translate (target centre − glass centre) plus one scale is the
 * entire move. No measuring of the scaled box is ever needed.
 */

export type TheaterLayout = "split" | "stack";

type Fit = { x: number; y: number; scale: number; layout: TheaterLayout };

export function theaterLayout(): TheaterLayout {
  const portrait = window.matchMedia("(orientation: portrait)").matches;
  return portrait || window.innerWidth < 900 ? "stack" : "split";
}

/** Where the glass should end up, in stage (viewport) coordinates. */
function targetRect(stage: DOMRect, layout: TheaterLayout) {
  const safeTop = 72; // header
  if (layout === "stack") {
    const top = stage.height * 0.1 + safeTop * 0.5;
    const bottom = stage.height * 0.52;
    return { x: stage.width * 0.06, y: top, w: stage.width * 0.88, h: bottom - top };
  }
  const top = Math.max(safeTop, stage.height * 0.13);
  const bottom = stage.height * 0.87;
  return { x: stage.width * 0.49, y: top, w: stage.width * 0.45, h: bottom - top };
}

function measure(section: HTMLElement): Fit | null {
  const stage = section.querySelector<HTMLElement>(".tv-stage");
  const anchor = section.querySelector<HTMLElement>(".tv-anchor");
  if (!stage || !anchor) return null;
  const style = getComputedStyle(anchor);
  const pct = (name: string) => parseFloat(style.getPropertyValue(name)) / 100;
  const stageRect = stage.getBoundingClientRect();
  // The anchor's own box, ignoring any residual transform from the tune-in
  // scrub (it is at scale 1 whenever a row can be clicked).
  const ax = anchor.offsetLeft;
  const ay = anchor.offsetTop;
  const aw = anchor.offsetWidth;
  const ah = anchor.offsetHeight;
  const glass = {
    x: ax + aw * pct("--screen-left"),
    y: ay + ah * pct("--screen-top"),
    w: aw * pct("--screen-width"),
    h: ah * pct("--screen-height"),
  };
  const layout = theaterLayout();
  const target = targetRect(stageRect, layout);
  const scale = Math.min(target.w / glass.w, target.h / glass.h);
  const gcx = glass.x + glass.w / 2;
  const gcy = glass.y + glass.h / 2;
  const tcx = target.x + target.w / 2;
  const tcy = target.y + target.h / 2;
  return { x: tcx - gcx, y: tcy - gcy, scale, layout };
}

export type TheaterHandle = {
  /** Re-fit the glass after a resize / orientation change. */
  refit: () => void;
  /**
   * Reveal the freshly mounted copy of another project. Called after React
   * swaps the keyed `.tv-sheet-content`; the persistent nav is untouched.
   */
  swap: (direction: 1 | -1) => void;
  /** Play the exit and resolve once the set is back on its mark. */
  close: () => Promise<void>;
};

export function openTheater(section: HTMLElement): TheaterHandle | null {
  const fit = measure(section);
  if (!fit) return null;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const box = section.querySelector<HTMLElement>(".tv-box");
  const list = section.querySelector<HTMLElement>(".works-list");
  const sheet = section.querySelector<HTMLElement>(".tv-sheet");
  const veil = section.querySelector<HTMLElement>(".tv-theater-veil");
  const scrim = section.querySelector<HTMLElement>(".tv-scrim");
  const nav = section.querySelector<HTMLElement>(".tv-sheet-nav");
  if (!box || !sheet) return null;

  section.dataset.tvPhase = "theater";
  section.dataset.theaterLayout = fit.layout;
  // Lock the page: the smoother keeps the pinned stage exactly where it is.
  ScrollSmoother.get()?.paused(true);

  const dur = reduce ? 0 : 1.15;
  const tl = gsap.timeline({ defaults: { ease: "expo.inOut", duration: dur } });
  tl.to(box, { x: fit.x, y: fit.y, scale: fit.scale, rotation: 0 }, 0)
    .to(list, { autoAlpha: 0, y: -24, duration: dur * 0.45, ease: "power2.in" }, 0)
    .to(scrim, { autoAlpha: 0, duration: dur * 0.5 }, 0)
    .fromTo(veil, { autoAlpha: 0 }, { autoAlpha: 1, duration: dur * 0.8 }, dur * 0.2)
    .fromTo(sheet, { autoAlpha: 0 }, { autoAlpha: 1, duration: dur * 0.4, ease: "none" }, dur * 0.45)
    .fromTo(
      sheet.querySelectorAll(".tv-sheet-reveal"),
      { yPercent: 110 },
      { yPercent: 0, duration: reduce ? 0 : 1.1, ease: "expo.out", stagger: 0.06 },
      dur * 0.5
    )
    .fromTo(
      sheet.querySelectorAll(".tv-sheet-fade"),
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.9, ease: "power3.out", stagger: 0.05 },
      dur * 0.7
    )
    // The nav is mounted once for the whole screening (it is not part of the
    // keyed project copy), so this is the only tween that ever shows it.
    .fromTo(nav, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.8, ease: "power3.out" }, dur * 0.8);

  const refit = () => {
    const next = measure(section);
    if (!next) return;
    section.dataset.theaterLayout = next.layout;
    gsap.to(box, { x: next.x, y: next.y, scale: next.scale, duration: 0.5, ease: "power3.out", overwrite: "auto" });
  };

  let swapTl: gsap.core.Timeline | null = null;
  const swap = (direction: 1 | -1) => {
    const content = sheet.querySelector<HTMLElement>(".tv-sheet-content");
    if (!content) return;
    swapTl?.kill();
    // Stepping before the entrance finished (arrow keys): land the sheet and
    // the nav on screen right away so the controls are always reachable.
    if (tl.progress() < 1) {
      tl.progress(1);
    }
    gsap.set([sheet, nav], { autoAlpha: 1, y: 0 });
    const d = reduce ? 0 : 1;
    swapTl = gsap
      .timeline()
      .fromTo(content, { x: 28 * direction }, { x: 0, duration: 0.8 * d, ease: "expo.out", clearProps: "transform" }, 0)
      .fromTo(
        content.querySelectorAll(".tv-sheet-reveal"),
        { yPercent: 110 },
        { yPercent: 0, duration: 0.85 * d, ease: "expo.out", stagger: 0.045 * d },
        0
      )
      .fromTo(
        content.querySelectorAll(".tv-sheet-fade"),
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.7 * d, ease: "power3.out", stagger: 0.05 * d },
        0.15 * d
      );
  };

  const close = () =>
    new Promise<void>((resolve) => {
      tl.kill();
      swapTl?.kill();
      const out = gsap.timeline({
        defaults: { ease: "expo.inOut", duration: dur },
        onComplete: () => {
          delete section.dataset.theaterLayout;
          section.dataset.tvPhase = "rows";
          ScrollSmoother.get()?.paused(false);
          ScrollTrigger.refresh();
          resolve();
        },
      });
      out
        .to(sheet.querySelectorAll(".tv-sheet-fade, .tv-sheet-reveal, .tv-sheet-nav"), { autoAlpha: 0, duration: dur * 0.3, ease: "power2.in" }, 0)
        .to(sheet, { autoAlpha: 0, duration: dur * 0.3, ease: "none" }, dur * 0.1)
        .to(veil, { autoAlpha: 0, duration: dur * 0.6 }, dur * 0.1)
        .to(box, { x: 0, y: 0, scale: 1, rotation: 0 }, dur * 0.1)
        .to(scrim, { autoAlpha: 1, duration: dur * 0.5 }, dur * 0.5)
        .to(list, { autoAlpha: 1, y: 0, duration: dur * 0.5, ease: "power2.out", clearProps: "transform" }, dur * 0.55);
    });

  return { refit, swap, close };
}
