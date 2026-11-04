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
import type { SectionId } from "../content/types";

export const DESKTOP_QUERY = "(min-width: 768px)";
export const MOBILE_QUERY = "(max-width: 767px)";
/** The pinned, side-scrolling intro only works with real horizontal room: a
 *  landscape viewport at least 1024 px wide and taller than a phone on its
 *  side. Tablets in portrait, short laptops with the dev-tools open and phones
 *  all get the vertical, flow-based intro instead (see `journeyFlow`). */
export const JOURNEY_PINNED_QUERY = "(min-width: 1024px) and (min-height: 561px) and (orientation: landscape)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

let registered = false;

export function registerGsap() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
  ScrollTrigger.config({ ignoreMobileResize: true });
  registered = true;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_QUERY).matches;
}

export function createSmoother() {
  registerGsap();
  return (
    ScrollSmoother.get() ??
    ScrollSmoother.create({
      wrapper: "#smooth-wrapper",
      content: "#smooth-content",
      smooth: prefersReducedMotion() ? 0 : 1.1,
      smoothTouch: false,
      effects: true,
      normalizeScroll: false,
    })
  );
}

export function scrollToSection(id: SectionId) {
  const target = document.getElementById(id);
  if (!target) return;
  const smoother = ScrollSmoother.get();
  if (smoother) {
    smoother.scrollTo(target, !prefersReducedMotion(), "top top");
  } else {
    target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }
}

/** Scroll dwell (in viewport heights) proportional to copy length. */
function dwell(element: Element | null, min: number, max: number) {
  const chars = element?.textContent?.trim().length ?? 0;
  const isCjk = /[\u3400-\u9fff]/.test(element?.textContent ?? "");
  const perViewport = isCjk ? 260 : 820;
  return gsap.utils.clamp(min, max, chars / perViewport);
}

/** Scrubbed reading light: words start dim and brighten in reading order so
 *  the eye is led through the paragraph at the pace of the scroll. */
function lightWords(tl: gsap.core.Timeline, selector: string, at: number, duration: number) {
  const words = gsap.utils.toArray<HTMLElement>(selector);
  if (!words.length) return;
  tl.fromTo(
    words,
    { opacity: 0.22 },
    { opacity: 1, duration: duration * 0.55, ease: "none", stagger: { each: (duration * 0.45) / words.length } },
    at
  );
}

/** Colour tokens live in CSS: `--stage` comes from the theme, `--sky` is
 * sampled from the television photograph (see portfolio.css). */
function cssColor(scope: HTMLElement, name: string, fallback: string) {
  return getComputedStyle(scope).getPropertyValue(name).trim() || fallback;
}

/** Vertical travel that brings the TV screen's centre to the middle of the stage. */
function screenLift(section: HTMLElement) {
  const stage = section.querySelector<HTMLElement>(".tv-stage");
  const anchor = section.querySelector<HTMLElement>(".tv-anchor");
  if (!stage || !anchor) return 0;
  const cy = parseFloat(getComputedStyle(anchor).getPropertyValue("--screen-cy")) / 100;
  return stage.clientHeight * 0.5 - anchor.offsetTop - anchor.offsetHeight * (Number.isFinite(cy) ? cy : 0.71);
}

export function createHeroEntrance() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out", duration: 1.5 } });
  tl.from(".hero-word-text", { yPercent: 118, stagger: 0.12 }, 0)
    .from(".hero-bar", { clipPath: "inset(100% 0% 0% 0%)", stagger: 0.12, duration: 1.7 }, 0.1)
    .from(".hero-photo-reveal", { clipPath: "inset(100% 0% 0% 0%)", duration: 1.7 }, 0)
    .from(".hero-photo-zoom", { scale: 1.32, duration: 2.2 }, 0)
    .from(".header-item", { yPercent: 120, autoAlpha: 0, stagger: 0.06, duration: 1.1 }, 0.45);
  return tl;
}

type Conditions = { desktop: boolean; mobile: boolean; journeyPinned: boolean; reduce: boolean };

export type ChoreographyOptions = {
  scope: HTMLElement;
  onSection: (section: SectionId) => void;
  onWork: (index: number) => void;
  lastWork: () => number;
  syncPointer?: () => void;
};

function heroScroll(desktop: boolean) {
  gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".hero-box",
      start: desktop ? "top 8%" : "top top",
      end: desktop ? "bottom 28%" : "bottom 40%",
      scrub: true,
    },
  })
    .to(".hero-word-1", { x: desktop ? "-1.2vw" : -12, y: desktop ? "3.6vw" : 80 }, 0)
    .to(".hero-word-2", { x: desktop ? "-1.2vw" : -12, y: desktop ? "3.6vw" : 80 }, 0.08)
    .to(".hero-word-3", { x: desktop ? "-1.2vw" : -12, y: desktop ? "3.6vw" : 80 }, 0.16);

  gsap.fromTo(
    ".hero-bar-image",
    { yPercent: -15 },
    {
      yPercent: 15,
      ease: "none",
      scrollTrigger: { trigger: ".hero-box", start: "top bottom", end: "bottom top", scrub: true },
    }
  );

  gsap.fromTo(
    ".hero-photo",
    { yPercent: desktop ? 6 : 0, scale: 1, rotation: 0 },
    {
      yPercent: desktop ? -6 : -8,
      scale: desktop ? 1.07 : 1.14,
      rotation: desktop ? 2.5 : 5,
      transformOrigin: "50% 55%",
      ease: "none",
      scrollTrigger: { trigger: ".hero-box", start: "top top", end: "bottom top", scrub: true },
    }
  );
}

function journeyDesktop(scope: HTMLElement, reduce: boolean) {
  const stage = scope.querySelector<HTMLElement>(".journey");
  const rail = scope.querySelector<HTMLElement>(".rail");
  if (!stage || !rail) return;

  const vw = () => window.innerWidth;
  const vh = () => window.innerHeight;
  const railWidth = () => rail.scrollWidth;

  const settle = 1;
  const approach = 0.7;
  const hold1 = dwell(scope.querySelector(".story-copy-inner"), 0.6, 1.4);
  const push = 1;
  const traverse = Math.max(0.6, ((railWidth() - vw() * 0.68) / vh()) * 0.8);
  const coda = 1;
  const hold2 = dwell(scope.querySelector(".coda-text"), 0.5, 1.1);
  const outro = 0.45;
  const total = settle + approach + hold1 + push + traverse + coda + hold2 + outro;

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: stage,
      start: "top top",
      end: () => `+=${total * vh()}`,
      pin: true,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  const at = {
    settle: 0,
    approach: settle,
    hold1: settle + approach,
    push: settle + approach + hold1,
    traverse: settle + approach + hold1 + push,
    coda: settle + approach + hold1 + push + traverse,
    hold2: settle + approach + hold1 + push + traverse + coda,
    outro: total - outro,
  };

  tl.fromTo(
    ".story-photo-box",
    // The portrait enters with the natural document flow and is already in
    // frame when the pin starts — the settle beat only reframes it (drift
    // down, un-tilt, widen, de-grey) instead of travelling a full stage.
    // Hiding it a full viewport above (-98vh) left a ~500px dead-black
    // stage between the hero exit and the portrait landing; starting at
    // -14vh keeps a short, intentional descent with zero black void, and
    // the pre-pin sliver reads as incoming content, not a layering bug.
    { y: () => -vh() * 0.14, x: () => vw() * 0.08 },
    { y: 0, x: 0, duration: settle, ease: "power2.out" },
    at.settle
  )
    .fromTo(
      ".story-photo-mask",
      { rotation: 18.17, width: "20vw", borderTopLeftRadius: "0vw", filter: "grayscale(40%)" },
      { rotation: -3, width: "27vw", borderTopLeftRadius: "13vw", filter: "grayscale(0%)", duration: settle, ease: "power1.inOut" },
      at.settle
    )
    .fromTo(".story-photo", { objectPosition: "50% 50%" }, { objectPosition: "50% 18%", duration: settle }, at.settle)
    .fromTo(
      ".story-photo-ghost",
      { rotation: 0, x: 0, y: 0, autoAlpha: 0.55 },
      { rotation: 9, x: "2.6vw", y: "2.2vw", autoAlpha: 0.35, duration: settle },
      at.settle
    )
    .fromTo(".story-title-text", { yPercent: -110 }, { yPercent: 0, duration: 0.7, ease: "power3.out" }, at.settle + 0.12)
    .fromTo(
      ".story-credit",
      { scale: 0.01, autoAlpha: 0, rotation: 18 },
      { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.3, ease: "back.out(2)" },
      at.settle + 0.66
    )
    .fromTo(".story-kicker", { autoAlpha: 0, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.3, ease: "power2.out" }, at.settle + 0.2)
    // The biography enters from the right and parks beside the portrait; the
    // lead sentence arrives first, the body a beat later.
    .fromTo(".story-copy", { x: 0 }, { x: () => -vw() * 0.5, duration: approach, ease: "power2.out" }, at.approach)
    .fromTo(".copy-lead", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: approach * 0.6, ease: "power2.out" }, at.approach + approach * 0.2)
    .fromTo(".copy-body", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: approach * 0.6, ease: "power2.out" }, at.approach + approach * 0.4)
    .fromTo(".story-copy-rule", { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: approach * 0.7, ease: "power2.out" }, at.approach + approach * 0.3)
    .to(".story-layer", { x: () => -vw() * 1.08, duration: push, ease: "power1.inOut" }, at.push)
    // Soft parallax: the portrait lingers a touch behind the copy as both leave.
    .fromTo(".story-photo-box", { xPercent: 0 }, { xPercent: 12, duration: push, ease: "power1.in" }, at.push)
    .fromTo(".rail", { x: () => vw() }, { x: () => vw() * 0.06, duration: push, ease: "power1.inOut" }, at.push)
    .fromTo(".rail-image", { xPercent: 10 }, { xPercent: -10, duration: push + traverse + coda }, at.push)
    .to(".rail", { x: () => -(railWidth() - vw() * 0.62), duration: traverse }, at.traverse)
    .to(".rail", { x: () => -(railWidth() + vw() * 0.05), duration: coda, ease: "power1.in" }, at.coda)
    .fromTo(".coda", { x: 0 }, { x: () => -vw() * 0.95, duration: coda, ease: "power2.out" }, at.coda)
    .fromTo(".coda-pic-1", { y: () => vh() * 0.7, rotation: 6 }, { y: () => -vh() * 0.04, rotation: 0, duration: coda * 0.9, ease: "power2.out" }, at.coda + 0.1)
    .fromTo(".coda-pic-2", { y: () => vh() * 0.95, rotation: -5 }, { y: () => vh() * 0.03, rotation: 0, duration: coda * 0.85, ease: "power2.out" }, at.coda + 0.15)
    .to(".coda-pic-1", { y: () => -vh() * 0.2, duration: outro }, at.outro)
    .to(".coda-pic-2", { y: () => -vh() * 0.08, duration: outro }, at.outro)
    .to(".coda-text", { y: () => -vh() * 0.04, duration: outro }, at.outro);

  // Reading light is motion: under `prefers-reduced-motion` the words are lit
  // by CSS instead (see the `.copy-word` rule in the reduced-motion block).
  if (!reduce) {
    lightWords(tl, ".story-copy .copy-word", at.hold1 - approach * 0.2, hold1 + approach * 0.2);
    lightWords(tl, ".coda-text .copy-word", at.hold2 - coda * 0.3, hold2 + coda * 0.3);
  }

  tl
    // Black -> the photograph's night sky, from the gallery push to the coda.
    // Every journey layer paints var(--stage), so tweening the variable on the
    // section recolours all of them, and the timeline ends on exactly the
    // colour the works stage starts with: the hand-over has no seam.
    .fromTo(
      stage,
      { "--stage": cssColor(scope, "--stage", "#000000") },
      { "--stage": cssColor(scope, "--sky", "#001c5c"), duration: total - at.push, ease: "sine.inOut" },
      at.push
    );
}

function journeyFlow(scope: HTMLElement, desktop: boolean, reduce: boolean) {
  // Same colour hand-over as desktop, spread over the section's own scroll.
  const journey = scope.querySelector<HTMLElement>(".journey");
  if (journey) {
    gsap.fromTo(
      journey,
      { "--stage": cssColor(scope, "--stage", "#000000") },
      {
        "--stage": cssColor(scope, "--sky", "#001c5c"),
        ease: "sine.inOut",
        scrollTrigger: { trigger: journey, start: "top 40%", end: "bottom bottom", scrub: true },
      }
    );
  }

  gsap.from(".story-photo-mask", {
    clipPath: "inset(100% 0% 0% 0%)",
    duration: 1.4,
    ease: "expo.out",
    scrollTrigger: { trigger: ".story-photo-box", start: "top 80%" },
  });
  gsap.from(".story-title-text", {
    yPercent: 110,
    duration: 1.2,
    ease: "expo.out",
    scrollTrigger: { trigger: ".story-title", start: "top 85%" },
  });
  gsap.from(".story-kicker", {
    autoAlpha: 0,
    x: -12,
    duration: 0.9,
    ease: "power2.out",
    scrollTrigger: { trigger: ".story-kicker", start: "top 90%" },
  });
  gsap.from(".story-copy-rule", {
    scaleX: 0,
    transformOrigin: "0% 50%",
    duration: 1.2,
    ease: "power3.out",
    scrollTrigger: { trigger: ".story-copy-rule", start: "top 92%" },
  });
  // Paragraphs rise in, then their words brighten with the scroll — the same
  // reading light as the pinned intro, spread over the paragraph's own height.
  gsap.utils.toArray<HTMLElement>(".story-copy p, .coda-text").forEach((el) => {
    gsap.from(el, {
      y: 40,
      autoAlpha: 0,
      duration: 1.1,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
    const words = el.querySelectorAll(".copy-word");
    if (!words.length || reduce) return;
    gsap.fromTo(
      words,
      { opacity: 0.28 },
      {
        opacity: 1,
        ease: "none",
        stagger: 0.6 / words.length,
        duration: 0.4,
        scrollTrigger: { trigger: el, start: desktop ? "top 72%" : "top 78%", end: desktop ? "bottom 45%" : "bottom 50%", scrub: 0.4 },
      }
    );
  });

  const rail = scope.querySelector<HTMLElement>(".rail");
  const railStage = scope.querySelector<HTMLElement>(".rail-stage");
  if (rail && railStage) {
    gsap.to(rail, {
      x: () => -(rail.scrollWidth - window.innerWidth + 20),
      ease: "none",
      scrollTrigger: {
        trigger: railStage,
        start: "center center",
        end: () => `+=${rail.scrollWidth * 0.9}`,
        pin: true,
        scrub: true,
        invalidateOnRefresh: true,
      },
    });
  }
}

type TvPhase = "rows" | "phone" | "exit";

function television(scope: HTMLElement, opts: ChoreographyOptions, desktop: boolean) {
  const section = scope.querySelector<HTMLElement>("#works");
  if (!section) return;
  const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  let phase: TvPhase = "rows";
  const setPhase = (next: TvPhase) => {
    phase = next;
    section.dataset.tvPhase = next;
  };
  setPhase("rows");

  ScrollTrigger.create({
    trigger: ".tv-stage",
    start: "top top",
    endTrigger: ".tv-exit-spacer",
    end: "bottom bottom",
    pin: true,
    pinSpacing: false,
    anticipatePin: 1,
  });

  // Channel change into the scene. The journey has faded to the photograph's
  // own sky, so the picture arrives through it like a set tuning in: static
  // and a sync bar roll over the incoming frame (feathered at its top edge so
  // the sky seam stays invisible) while the shot settles from a slight push.
  gsap
    .timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: ".tv-stage", start: "top bottom", end: "top top", scrub: 0.4 },
    })
    .fromTo(".tv-tune", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.28 }, 0.1)
    .fromTo(".tv-tune-bar", { yPercent: -120 }, { yPercent: 640, duration: 0.78, ease: "power1.inOut" }, 0.1)
    .to(".tv-tune", { autoAlpha: 0, duration: 0.28, ease: "power2.in" }, 0.68)
    .fromTo(".tv-anchor", { scale: 1.06, transformOrigin: "50% 0%" }, { scale: 1, duration: 1, ease: "power2.out" }, 0);

  // The index's reading light follows the list onto the photograph.
  gsap.fromTo(
    ".tv-scrim",
    { autoAlpha: 0 },
    {
      autoAlpha: 1,
      ease: "none",
      scrollTrigger: { trigger: ".works-list", start: "top bottom", end: "top 45%", scrub: true },
    }
  );

  gsap.from(".works-heading-text", {
    yPercent: 110,
    duration: 1.3,
    ease: "expo.out",
    scrollTrigger: { trigger: ".works-heading", start: "top 85%", toggleActions: "play none none reverse" },
  });

  gsap.utils.toArray<HTMLElement>(".work-row").forEach((row, index) => {
    const reveal = { trigger: row, start: "top 90%", toggleActions: "play none none reverse" };
    gsap.from(row.querySelector(".work-row-line"), {
      scaleX: 0,
      transformOrigin: "0% 50%",
      duration: 1.3,
      ease: "expo.inOut",
      scrollTrigger: reveal,
    });
    gsap.from(row.querySelectorAll(".work-row-title, .work-row-meta span"), {
      yPercent: 115,
      duration: 1.15,
      ease: "expo.out",
      stagger: 0.05,
      delay: 0.12,
      scrollTrigger: reveal,
    });
    // On fine-pointer devices the TV stays on the untouched `tv.webp` until the
    // cursor dot actually hovers a `.work-row`; touch devices have no cursor,
    // so rows preview as they cross the reading band and return to `tv.webp`
    // once the last row finishes scrolling.
    if (!hoverCapable) {
      ScrollTrigger.create({
        trigger: row,
        start: "top 62%",
        end: "bottom 62%",
        onToggle: (self) => {
          if (self.isActive && phase === "rows") opts.onWork(index);
        },
      });
    }
  });

  ScrollTrigger.create({
    trigger: ".work-rows",
    start: hoverCapable ? "top bottom" : "top 62%",
    end: hoverCapable ? "bottom top" : "bottom 62%",
    onUpdate: () => {
      if (hoverCapable && phase === "rows") opts.syncPointer?.();
    },
    onLeave: () => opts.onWork(-1),
    onLeaveBack: () => opts.onWork(-1),
  });

  const lean = desktop ? 2.4 : 2;
  const phoneTl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".tv-phone-spacer",
      start: "top 70%",
      end: "bottom 30%",
      scrub: true,
      invalidateOnRefresh: true,
      onEnter: () => {
        setPhase("phone");
        opts.onWork(-1);
      },
      onEnterBack: () => {
        setPhase("phone");
        opts.onWork(-1);
      },
      onLeaveBack: () => {
        setPhase("rows");
        if (hoverCapable) opts.syncPointer?.();
        else opts.onWork(opts.lastWork());
      },
    },
  });

  // The set is framed whole now, so this beat travels further than the old
  // 1.14 lean: the anchor lifts the screen to the optical centre while the box
  // leans in, landing on about the screen size the 185vw crop showed.
  phoneTl
    .to(".tv-anchor", { y: () => screenLift(section), duration: 0.34, ease: "sine.inOut" }, 0)
    .to(".tv-box", { scale: lean, rotation: -1.5, duration: 0.34, ease: "sine.inOut" }, 0)
    .fromTo(".tv-scrim, .tv-seam", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2, immediateRender: false }, 0)
    .fromTo(
      ".tv-number",
      { autoAlpha: 0, yPercent: 18, scale: 0.92, filter: "blur(6px)" },
      { autoAlpha: 1, yPercent: 0, scale: 1, filter: "blur(0px)", duration: 0.18, ease: "power2.out" },
      0.1
    )
    .to(".tv-number", { autoAlpha: 1, duration: 0.72 }, 0.28);

  const exitTl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".tv-exit-spacer",
      start: "top 30%",
      end: "bottom bottom",
      scrub: true,
      onEnter: () => setPhase("exit"),
      onLeaveBack: () => setPhase("phone"),
    },
  });

  // Exit over the untouched `tv.webp` photograph:
  //   1. `@BrainEno` zooms up inside the original TV screen and dissolves out,
  //   2. the TV pushes in while cross-fading cleanly by opacity into `.tv-whiteout`
  //      and the rising Contact sheet — zero screen-overlay sticker to misalign.
  exitTl
    .to(".tv-number", { scale: desktop ? 4.8 : 3.2, duration: 0.28, ease: "power2.in" }, 0)
    .to(".tv-number", { autoAlpha: 0, filter: "blur(14px)", duration: 0.2, ease: "power1.in" }, 0.08)
    .to(".tv-box", { scale: lean * 1.07, rotation: -2.4, duration: 0.12, ease: "sine.inOut" }, 0.04)
    .to(".tv-box", { scale: lean * 4.56, rotation: -5.5, duration: 0.32, ease: "power2.in" }, 0.14)
    .to(".tv-box", { autoAlpha: 0, duration: 0.22, ease: "power1.inOut" }, 0.24)
    .fromTo(".tv-whiteout", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.24, ease: "power1.inOut" }, 0.22)
    .fromTo(
      ".contact",
      { backgroundColor: "rgba(255,255,255,0)" },
      { backgroundColor: "rgba(255,255,255,1)", duration: 0.2, ease: "power1.inOut" },
      0.28
    )
    .to(".tv-whiteout", { autoAlpha: 1, duration: 0.54 }, 0.46);
}

function contact(scope: HTMLElement, desktop: boolean, reduce: boolean) {
  const rows = gsap.utils.toArray<HTMLElement>(".contact-reel-row", scope);
  if (reduce) {
    gsap.set(
      ".contact-booth, .contact-booth-shadow, .contact-reel-row, .contact-topbar > *, .contact-cta-label, .contact-mail-text, .contact-mail-arrow, .contact-cta .contact-item, .contact-footer > *",
      { autoAlpha: 1, clearProps: "transform" }
    );
    return;
  }
  const vw = () => window.innerWidth;
  const vh = () => window.innerHeight;

  // Arrival, scrubbed with the sheet rising out of the white burn: the two
  // bands slide in from opposite edges while the booth rises onto its mark and
  // settles — one composed move instead of the old sideways throw.
  const arrive = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: "#contact", start: "top 100%", end: "top 0%", scrub: 0.8, invalidateOnRefresh: true },
  });
  rows.forEach((row, index) => {
    arrive.fromTo(row, { x: () => vw() * (index % 2 ? -0.32 : 0.32) }, { x: 0, duration: 1, ease: "power3.out" }, 0);
  });
  arrive
    .fromTo(
      ".contact-booth",
      { autoAlpha: 0, y: () => vh() * 0.26, scale: 0.84, rotation: desktop ? -3 : 0, transformOrigin: "50% 100%" },
      { autoAlpha: 1, y: 0, scale: 1, rotation: 0, duration: 0.9, ease: "power3.out" },
      0.1
    )
    .fromTo(".contact-booth-shadow", { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: "power2.out" }, 0.5);

  // Type reveals are time-based rather than scrubbed: crisp, deliberate, and
  // never left half-risen when the visitor stops scrolling midway.
  gsap
    .timeline({
      defaults: { ease: "expo.out", duration: 1.2 },
      scrollTrigger: { trigger: ".contact-stage", start: "top 75%", toggleActions: "play none none reverse" },
    })
    .fromTo(".contact-topbar > *", { autoAlpha: 0, yPercent: 60 }, { autoAlpha: 1, yPercent: 0, stagger: 0.08 }, 0);

  gsap
    .timeline({
      defaults: { ease: "expo.out", duration: 1.3 },
      scrollTrigger: { trigger: ".contact-cta", start: "top 95%", toggleActions: "play none none reverse" },
    })
    .fromTo(".contact-cta-label", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0 }, 0)
    .fromTo(".contact-mail-text", { yPercent: 110 }, { yPercent: 0 }, 0.06)
    .fromTo(".contact-mail-arrow", { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 1.1 }, 0.3)
    .fromTo(".contact-cta .contact-item, .contact-footer > *", { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, stagger: 0.06 }, 0.2);

  // Endless counter-running bands; scroll velocity briefly speeds them up.
  const loops = rows.map((row, index) => {
    const tracks = row.querySelectorAll(".contact-reel-track");
    const duration = (desktop ? 44 : 28) * (index % 2 ? 1.15 : 1);
    return index % 2
      ? gsap.fromTo(tracks, { xPercent: -100 }, { xPercent: 0, duration, ease: "none", repeat: -1 })
      : gsap.to(tracks, { xPercent: -100, duration, ease: "none", repeat: -1 });
  });
  if (!loops.length) return;
  ScrollTrigger.create({
    trigger: "#contact",
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => loops.forEach((loop) => (self.isActive ? loop.play() : loop.pause())),
    onUpdate: (self) => {
      const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 320, 5);
      loops.forEach((loop) => {
        gsap.to(loop, { timeScale: boost, duration: 0.2, overwrite: true });
        gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.2, ease: "power2.out" });
      });
    },
  });
}

function sectionTracking(opts: ChoreographyOptions) {
  ScrollTrigger.create({
    trigger: "#works",
    start: "top 50%",
    onEnter: () => opts.onSection("works"),
    onLeaveBack: () => opts.onSection("intro"),
  });
  ScrollTrigger.create({
    trigger: "#contact",
    start: "top 55%",
    onEnter: () => opts.onSection("contact"),
    onLeaveBack: () => opts.onSection("works"),
  });
}

export function setupChoreography(opts: ChoreographyOptions) {
  registerGsap();
  const { scope } = opts;
  const mm = gsap.matchMedia(scope);

  mm.add(
    { desktop: DESKTOP_QUERY, mobile: MOBILE_QUERY, journeyPinned: JOURNEY_PINNED_QUERY, reduce: REDUCED_QUERY },
    (context) => {
      const { desktop, journeyPinned, reduce } = context.conditions as Conditions;
      heroScroll(desktop);
      if (journeyPinned) journeyDesktop(scope, reduce);
      else journeyFlow(scope, desktop, reduce);
      television(scope, opts, desktop);
      contact(scope, desktop, reduce);
      sectionTracking(opts);
    }
  );

  let disposed = false;
  let refreshTimer = 0;
  const refresh = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => !disposed && ScrollTrigger.refresh(), 120);
  };
  void document.fonts?.ready.then(refresh);
  const images = Array.from(scope.querySelectorAll("img")).filter((img) => !img.complete);
  images.forEach((img) => img.addEventListener("load", refresh, { once: true }));
  refresh();

  return () => {
    disposed = true;
    window.clearTimeout(refreshTimer);
    images.forEach((img) => img.removeEventListener("load", refresh));
    mm.revert();
  };
}
