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

export function createHeroEntrance() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out", duration: 1.5 } });
  tl.from(".hero-word-text", { yPercent: 118, stagger: 0.12 }, 0)
    .from(".hero-bar", { clipPath: "inset(100% 0% 0% 0%)", stagger: 0.12, duration: 1.7 }, 0.1)
    .from(".hero-photo-reveal", { clipPath: "inset(100% 0% 0% 0%)", duration: 1.7 }, 0)
    .from(".hero-photo-zoom", { scale: 1.32, duration: 2.2 }, 0)
    .from(".header-item", { yPercent: 120, autoAlpha: 0, stagger: 0.06, duration: 1.1 }, 0.45);
  return tl;
}

type Conditions = { desktop: boolean; mobile: boolean; reduce: boolean };

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

function journeyDesktop(scope: HTMLElement) {
  const stage = scope.querySelector<HTMLElement>(".journey");
  const rail = scope.querySelector<HTMLElement>(".rail");
  if (!stage || !rail) return;

  const vw = () => window.innerWidth;
  const vh = () => window.innerHeight;
  const railWidth = () => rail.scrollWidth;

  const settle = 1;
  const approach = 0.7;
  const hold1 = dwell(scope.querySelector(".story-copy p"), 0.45, 1.25);
  const push = 1;
  const traverse = Math.max(0.6, ((railWidth() - vw() * 0.68) / vh()) * 0.8);
  const coda = 1;
  const hold2 = dwell(scope.querySelector(".coda-text"), 0.4, 1);
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
    .fromTo(".story-copy", { x: 0 }, { x: () => -vw() * 0.47, duration: approach, ease: "power2.out" }, at.approach)
    .fromTo(".story-copy p", { autoAlpha: 0.25 }, { autoAlpha: 1, duration: approach * 0.8 }, at.approach)
    .to(".story-layer", { x: () => -vw() * 1.08, duration: push, ease: "power1.inOut" }, at.push)
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
}

function journeyMobile(scope: HTMLElement) {
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
  gsap.utils.toArray<HTMLElement>(".story-copy p, .coda-text").forEach((el) => {
    gsap.from(el, {
      y: 40,
      autoAlpha: 0,
      duration: 1.1,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
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

function television(scope: HTMLElement, opts: ChoreographyOptions, desktop: boolean, reduce: boolean) {
  const section = scope.querySelector<HTMLElement>("#works");
  if (!section) return;
  const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const vh = () => window.innerHeight;
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

  /* Beat one: the dark chapter opens into midnight blue and the complete 3:2
     street photograph. No scale is applied here, so the sky stays in frame. */
  if (reduce) {
    gsap.set(".tv-atmosphere, .tv-anchor", { autoAlpha: 1 });
  } else {
    gsap
      .timeline({
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "top top",
          scrub: 0.65,
        },
      })
      .fromTo(
        ".tv-atmosphere",
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.72, ease: "power1.inOut" },
        0
      )
      .fromTo(
        ".tv-anchor",
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.58, ease: "power1.out" },
        0.28
      );
  }

  gsap.from(".works-heading-text", {
    yPercent: 110,
    duration: 1.3,
    ease: "expo.out",
    scrollTrigger: { trigger: ".works-heading", start: "top 85%", toggleActions: "play none none reverse" },
  });

  /* Beat two: only when the project index arrives do we push into the CRT.
     The transform origin remains the screen centre from the content config. */
  if (!reduce) {
    gsap.to(".tv-box", {
      scale: desktop ? 2.65 : 2.5,
      y: () => -vh() * (desktop ? 0.14 : 0.08),
      rotation: desktop ? -0.6 : 0,
      duration: 1,
      ease: "power1.inOut",
      scrollTrigger: {
        trigger: ".works-list",
        start: "top 92%",
        end: "top 18%",
        scrub: 0.65,
        invalidateOnRefresh: true,
      },
    });
  }

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
    // On fine-pointer devices the TV stays on the untouched photograph until
    // the cursor hovers a row. Touch rows preview across the reading band.
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

  const phoneTl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".tv-phone-spacer",
      start: "top 70%",
      end: "bottom 30%",
      scrub: true,
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

  phoneTl
    .to(
      ".tv-box",
      {
        scale: reduce ? 1 : desktop ? 2.82 : 2.65,
        rotation: reduce ? 0 : -1.5,
        duration: 0.34,
        ease: "sine.inOut",
      },
      0
    )
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

  // Continue from the channel-zoom scale instead of snapping back to 1x.
  // The white sheet and Contact share the same scroll interval for a clean,
  // reversible hand-off rather than a second, disconnected animation.
  exitTl
    .to(".tv-number", { scale: desktop ? 4.8 : 3.2, duration: 0.28, ease: "power2.in" }, 0)
    .to(".tv-number", { autoAlpha: 0, filter: "blur(14px)", duration: 0.2, ease: "power1.in" }, 0.08)
    .to(
      ".tv-box",
      {
        scale: reduce ? 1 : desktop ? 3 : 2.8,
        rotation: reduce ? 0 : -2.4,
        duration: 0.12,
        ease: "sine.inOut",
      },
      0.04
    )
    .to(
      ".tv-box",
      {
        scale: reduce ? 1 : desktop ? 6.2 : 5.2,
        rotation: reduce ? 0 : -5.5,
        duration: 0.32,
        ease: "power2.in",
      },
      0.14
    )
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

function contact(desktop: boolean, reduce: boolean) {
  if (reduce) {
    gsap.set(".contact-booth", { autoAlpha: 1, clearProps: "transform" });
    gsap.set(".contact-booth-shadow", { autoAlpha: 1 });
    gsap.set(".contact-headlines, .contact-kicker, .contact-kicker-rule, .contact-line-text, .contact-marquee", {
      autoAlpha: 1,
      clearProps: "transform",
    });
    gsap.set(".contact-item, .contact-colophon > *", { autoAlpha: 1, clearProps: "transform" });
    return;
  }

  const vh = () => window.innerHeight;

  // The booth stays in its own grid column and makes one restrained landing.
  // Drag rotation remains owned by the model; scroll only moves the carrier.
  gsap
    .timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: "#contact",
        start: "top 100%",
        end: "top 12%",
        scrub: 0.65,
        invalidateOnRefresh: true,
      },
    })
    .fromTo(
      ".contact-booth",
      {
        autoAlpha: 0,
        y: () => vh() * (desktop ? 0.08 : 0.05),
        rotation: 1.2,
        scale: 0.96,
        transformOrigin: "50% 70%",
      },
      {
        autoAlpha: 1,
        y: 0,
        rotation: 0,
        scale: 1,
        duration: 0.72,
        ease: "power2.out",
      },
      0
    )
    .fromTo(
      ".contact-booth-shadow",
      { autoAlpha: 0, scale: 0.72 },
      { autoAlpha: 1, scale: 1, duration: 0.4, ease: "power2.out" },
      0.28
    );

  // Solid type rises through a mask once. There is no width measurement,
  // outline/glitch hover state or continuous animation competing for attention.
  gsap
    .timeline({
      scrollTrigger: {
        trigger: "#contact",
        start: "top 98%",
        end: "top 30%",
        scrub: 0.55,
        invalidateOnRefresh: true,
      },
    })
    .fromTo(
      ".contact-headlines",
      { y: () => vh() * 0.08 },
      { y: 0, duration: 1, ease: "power2.out" },
      0
    )
    .fromTo(
      ".contact-kicker",
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.34, ease: "power2.out" },
      0.04
    )
    .fromTo(
      ".contact-kicker-rule",
      { scaleX: 0 },
      { scaleX: 1, duration: 0.4, ease: "expo.out" },
      0.08
    )
    .fromTo(
      ".contact-line-text",
      { yPercent: 106 },
      {
        yPercent: 0,
        duration: 0.62,
        stagger: 0.08,
        ease: "power3.out",
      },
      0.1
    )
    .fromTo(
      ".contact-marquee",
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: 0.38, ease: "power2.out" },
      0.46
    );

  gsap.from(".contact-item, .contact-colophon > *", {
    y: 16,
    autoAlpha: 0,
    duration: 0.8,
    ease: "power3.out",
    stagger: 0.06,
    scrollTrigger: {
      trigger: ".contact-marquee",
      start: "top 92%",
      toggleActions: "play none none reverse",
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

  mm.add({ desktop: DESKTOP_QUERY, mobile: MOBILE_QUERY, reduce: REDUCED_QUERY }, (context) => {
    const { desktop, reduce } = context.conditions as Conditions;
    heroScroll(desktop);
    if (desktop) journeyDesktop(scope);
    else journeyMobile(scope);
    television(scope, opts, desktop, reduce);
    contact(desktop, reduce);
    sectionTracking(opts);
  });

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
