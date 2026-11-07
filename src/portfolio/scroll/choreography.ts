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
const TOUCH_QUERY = "(hover: none), (pointer: coarse)";
/**
 * Touch scroll events arrive coalesced and in uneven bundles during a
 * momentum fling. A raw 1:1 scrub writes every bundle straight into the intro's
 * transforms and background colour, so the gallery rail micro-steps and a fast
 * flick reads as a shake. 0.45 s of GSAP interpolation smooths the sampling
 * without changing any trigger range, pin spacing, easing or DOM geometry.
 * Reduced motion keeps the rigid 1:1 behaviour: trailing 0.45 s of motion is
 * still motion, and that preference asks for none.
 */
const INTRO_TOUCH_SCRUB = 0.45;

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

/**
 * How the pinned sections are held in place.
 *
 * With smooth scrolling the content is a transformed layer, so a pin has to
 * ride that layer with a `translate` GSAP re-writes on every scroll tick
 * (`"transform"`). On touch devices ScrollSmoother leaves the page native —
 * `#smooth-content` keeps `transform: none` — and there that per-tick write
 * lands a frame *after* the compositor has already scrolled: the pinned box
 * slides up with the page and is yanked back, so pinned art (the gallery rail)
 * visibly shakes, the harder the faster the fling. Native pages get
 * `position: fixed` instead, which the browser holds in place with no script
 * involved at all.
 */
let cachedPinType: "fixed" | "transform" | null = null;
function pinType(): "fixed" | "transform" {
  if (cachedPinType) return cachedPinType;
  // ScrollSmoother holds its wrapper fixed while it smooths the content; when it
  // leaves the page native it writes `position: relative` back and never
  // transforms the content. Both signals are read, because either one alone is
  // enough to prove the layer is not a plain document flow.
  const wrapper = document.getElementById("smooth-wrapper");
  const content = document.getElementById("smooth-content");
  const smoothed =
    (!!wrapper && getComputedStyle(wrapper).position === "fixed") ||
    (!!content && getComputedStyle(content).transform !== "none");
  cachedPinType = smoothed ? "transform" : "fixed";
  return cachedPinType;
}

/** A choreography rebuild (language, width, orientation) can change the
 *  smoother's wrapper, so do not carry the old pin strategy across it. */
function resetPinType() {
  cachedPinType = null;
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
    { opacity: 0.42 },
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
  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: "expo.out", duration: 1.5 },
  });

  tl.from(
    ".hero-photo-reveal",
    { clipPath: "inset(100% 0% 0% 0%)", duration: 1.7 },
    0
  )
    .from(".hero-photo-zoom", { scale: 1.32, duration: 2.2 }, 0)
    // Each row wipes open along its own baseline. The per-row lean is static
    // CSS (`transform: rotate(...)` on `.hero-word-1/2/3`), so the entrance
    // deliberately writes no transform on the rows: GSAP would merge the CSS
    // angle into `transform` and then overwrite it with the tween's value.
    .fromTo(
      ".hero-word",
      { clipPath: "inset(0% 100% 0% 0%)" },
      {
        clipPath: "inset(0% 0% 0% 0%)",
        stagger: 0.1,
        duration: 1.35,
      },
      0.15
    )
    .from(
      ".hero-word-text",
      { xPercent: 18, stagger: 0.1, duration: 1.5 },
      0.15
    )
    .from(
      ".hero-word-index",
      { autoAlpha: 0, x: -8, stagger: 0.1, duration: 0.75 },
      0.55
    )
    .from(
      ".hero-bar",
      {
        clipPath: "inset(100% 0% 0% 0%)",
        stagger: 0.12,
        duration: 1.7,
      },
      0.1
    )
    .from(
      ".header-item",
      { yPercent: 120, autoAlpha: 0, stagger: 0.06, duration: 1.1 },
      0.45
    );

  return tl;
}

export type Loader = {
  /** Warm-up and the first 82 % of the scan, played while the page decodes. */
  intro: gsap.core.Timeline;
  /** Finish the scan, lock the signal, flood the tube and dive into the hero. */
  reveal: (hooks: { delay: number; entrance: () => void; done: () => void }) => gsap.core.Timeline;
};

/**
 * The loading screen (markup in `ui/Portfolio.tsx#Preloader`), in four beats:
 *
 * 1. **Scan** — a phosphor beam rasters the wordmark top to bottom; above it the
 *    letters are lit, below it they are still dark glass. The beam position is
 *    the load progress (`--scan`, 0–1) and the counter rides along with it.
 * 2. **Lock** — the beam flares out, the phosphor overdrives for a moment and
 *    the colour guns slip (red / cyan copies jitter, then converge).
 * 3. **Flood** — a full white raster rolls down the tube. Above its edge the
 *    loader is replaced by `.preloader-flood`: white with the letters punched
 *    out (black under `mix-blend-mode: screen` is transparent to the page).
 * 4. **Dive** — the camera pushes through the stem of the "I" (`.is-pivot`)
 *    until the hole fills the viewport; the hero entrance starts on the way in.
 *
 * `quick` (a repeat visit in the same session) halves every beat.
 */
export function createLoader(preloader: HTMLElement, flood: HTMLElement, quick: boolean): Loader {
  const k = quick ? 0.5 : 1;
  const stretch = preloader.querySelector<HTMLElement>(".preloader-stretch");
  const ghost = preloader.querySelector<HTMLElement>(".preloader-word-ghost");
  const lit = preloader.querySelector<HTMLElement>(".preloader-word-lit");
  const red = preloader.querySelector<HTMLElement>(".preloader-word-r");
  const cyan = preloader.querySelector<HTMLElement>(".preloader-word-c");
  const beam = preloader.querySelector<HTMLElement>(".preloader-beam");
  const count = preloader.querySelector<HTMLElement>(".preloader-count");
  const wipe = preloader.querySelector<HTMLElement>(".preloader-wipe");
  const mark = flood.querySelector<HTMLElement>(".preloader-mark");
  const pivot = flood.querySelector<HTMLElement>(".is-pivot");
  const guns = [red, cyan].filter((el): el is HTMLElement => Boolean(el));

  const scan = { value: 0 };
  const paintScan = () => {
    stretch?.style.setProperty("--scan", (scan.value / 100).toFixed(4));
    if (count) count.textContent = String(Math.round(scan.value)).padStart(3, "0");
  };
  const flooded = { value: 0 };
  const paintFlood = () => {
    const p = flooded.value;
    preloader.style.clipPath = `inset(${p}% 0% 0% 0%)`;
    flood.style.clipPath = `inset(0% 0% ${100 - p}% 0%)`;
    if (wipe) wipe.style.top = `${p}%`;
  };

  const intro = gsap.timeline();
  if (ghost) intro.fromTo(ghost, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 * k, ease: "power2.out" }, 0);
  if (beam) intro.fromTo(beam, { autoAlpha: 0, scaleX: 0 }, { autoAlpha: 1, scaleX: 1, duration: 0.55 * k, ease: "expo.out" }, 0);
  intro.to(scan, { value: 82, duration: quick ? 0.35 : 1.15, ease: "power2.inOut", onUpdate: paintScan }, 0.15 * k);

  // The dive is aimed when it starts (fonts are ready by then): scale the hole
  // until the stem of the pivot letter covers the whole viewport.
  let aim: { scale: number; origin: string } | null = null;
  const aimDive = () => {
    if (aim) return aim;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const box = mark?.getBoundingClientRect();
    const hole = pivot?.getBoundingClientRect();
    if (!box || !hole || !hole.width || !hole.height) {
      aim = { scale: 60, origin: "50% 50%" };
      return aim;
    }
    const cx = hole.left + hole.width / 2;
    const cy = hole.top + hole.height / 2;
    // The span is the advance width and the whole line box; the stem and the
    // cap height are narrower than that, so both are taken conservatively.
    const stem = hole.width * 0.42;
    const cap = hole.height * 0.55;
    const scale = 1.12 * Math.max((2 * Math.max(cx, vw - cx)) / stem, (2 * Math.max(cy, vh - cy)) / cap);
    aim = { scale, origin: `${cx - box.left}px ${cy - box.top}px` };
    return aim;
  };

  const reveal: Loader["reveal"] = ({ delay, entrance, done }) => {
    const tl = gsap.timeline({ delay });
    tl.to(scan, { value: 100, duration: 0.35 * k, ease: "power2.out", onUpdate: paintScan }).addLabel("lock");
    if (beam) tl.to(beam, { scaleY: 7, autoAlpha: 0, duration: 0.32 * k, ease: "power2.out" }, "lock");
    if (count) tl.to(count, { autoAlpha: 0, duration: 0.18 * k }, "lock");
    if (lit) {
      tl.fromTo(lit, { filter: "brightness(1.9)" }, { filter: "brightness(1)", duration: 0.4 * k, ease: "power2.out" }, "lock")
        .set(lit, { x: 3, skewX: -7 }, "lock")
        .set(lit, { x: -2, skewX: 4 }, `lock+=${0.07 * k}`)
        .set(lit, { x: 0, skewX: 0 }, `lock+=${0.14 * k}`);
    }
    if (red && cyan) {
      tl.set(guns, { autoAlpha: 0.9 }, "lock")
        .set(red, { x: -9 }, "lock")
        .set(cyan, { x: 7 }, "lock")
        .set(red, { x: 5 }, `lock+=${0.07 * k}`)
        .set(cyan, { x: -4 }, `lock+=${0.07 * k}`)
        .set(red, { x: -2 }, `lock+=${0.14 * k}`)
        .set(cyan, { x: 2 }, `lock+=${0.14 * k}`)
        .set(guns, { autoAlpha: 0, x: 0 }, `lock+=${0.21 * k}`);
    }
    tl.addLabel("flood", `lock+=${0.2 * k}`);
    if (wipe) tl.set(wipe, { autoAlpha: 1 }, "flood");
    tl.to(flooded, { value: 100, duration: 0.5 * k, ease: "power3.inOut", onUpdate: paintFlood }, "flood").addLabel(
      "dive",
      `flood+=${0.56 * k}`
    );
    if (mark) {
      tl.to(
        mark,
        {
          scale: () => aimDive().scale,
          transformOrigin: () => aimDive().origin,
          duration: quick ? 0.7 : 1.05,
          ease: "power3.in",
        },
        "dive"
      );
    }
    tl.add(entrance, `dive+=${0.4 * k}`).add(done);
    return tl;
  };

  return { intro, reveal };
}

type Conditions = { desktop: boolean; mobile: boolean; journeyPinned: boolean; touch: boolean; reduce: boolean };

export type ChoreographyOptions = {
  scope: HTMLElement;
  onSection: (section: SectionId) => void;
  onWork: (index: number) => void;
  lastWork: () => number;
  syncPointer?: () => void;
};

/**
 * The boxes that paint the journey's hand-over colour.
 *
 * The ramp used to be a tween of the *inherited* `--stage` on the section: every
 * scroll tick then forced the browser to re-walk the journey's subtree and
 * restyle everything that inherits the variable. On a phone that was the single
 * largest style cost of the intro — a full scroll sweep measured 191 ms of style
 * work with it, 75 ms with it removed. Painting the same ramp straight onto the
 * boxes that use the variable leaves the colour at every scroll position
 * identical without touching the tree.
 */
const HANDOFF_PAINTED = ".journey, .story-photo-mask, .rail-item, .coda-pic";

/** `.works::before` reads `--handoff` from its own section, so the write is
 *  scoped there instead of on the page root (which restyled every descendant). */
function handoffScope(scope: HTMLElement): HTMLElement {
  return scope.querySelector<HTMLElement>("#works") ?? scope;
}

function heroScroll(desktop: boolean) {
  gsap
    .timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: ".hero-box",
        start: desktop ? "top 8%" : "top top",
        end: desktop ? "bottom 28%" : "bottom 40%",
        scrub: true,
      },
    })
    // The type rail's right axis stays locked to the photograph's left edge;
    // the whole group only counter-travels vertically.
    .to(".hero-type", { x: 0, y: desktop ? "2vw" : 12 }, 0);

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

function journeyDesktop(scope: HTMLElement, reduce: boolean, scrub: boolean | number) {
  const stage = scope.querySelector<HTMLElement>(".journey");
  const rail = scope.querySelector<HTMLElement>(".rail");
  const portrait = scope.querySelector<HTMLElement>(".story-photo-box");
  if (!stage || !rail || !portrait) return;

  const vw = () => window.innerWidth;
  const vh = () => window.innerHeight;
  const railWidth = () => rail.scrollWidth;

  // The pre-pin flight below owns the portrait's x/y and has already landed
  // it on the grid when the pin starts. This beat now only settles the mask:
  // widen, un-tilt and de-grey while the biography prepares to enter.
  const settle = 0.85;
  const approach = 0.7;
  const hold1 = dwell(scope.querySelector(".story-copy-inner"), 0.75, 1.4);
  const push = 1;
  const traverse = Math.max(0.6, ((railWidth() - vw() * 0.68) / vh()) * 0.8);
  const coda = 1;
  const hold2 = dwell(scope.querySelector(".coda-text"), 0.5, 1.1);
  const outro = 0.3;
  const total = settle + approach + hold1 + push + traverse + coda + hold2 + outro;

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: stage,
      start: "top top",
      end: () => `+=${total * vh()}`,
      pin: true,
      pinType: pinType(),
      scrub,
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

  /*
   * Hero -> Intro portrait approach.
   *
   * This trigger covers the whole pre-pin interval:
   *   journey.top: 100vh -> 0
   *
   * At its first frame the portrait is composed at approximately:
   *   viewport x = 19vw
   *   viewport y = 7vh
   * which is the high editorial position marked in the reference screenshot.
   *
   * `portrait.offsetTop/offsetLeft` are the natural grid position. Deriving the
   * compensation from them keeps the path correct if the gutter, grid or 18vh
   * landing changes later; do not replace these measurements with a hard-coded
   * pixel translation.
   *
   * The middle keyframe bows slightly left and puts the portrait at about 11vh
   * when the Journey top is at 48vh. The last keyframe ends at x=0/y=0 exactly
   * when the pinned timeline starts, so there is no transform hand-off jump.
   */
  const portraitNaturalTop = () => portrait.offsetTop;
  const portraitStartX = () => Math.max(0, vw() * 0.19 - portrait.offsetLeft);

  if (!reduce) {
    const portraitFlight = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: stage,
        start: "top bottom",
        end: "top top",
        scrub,
        invalidateOnRefresh: true,
      },
    });

    portraitFlight
      .fromTo(
        portrait,
        {
          x: () => portraitStartX(),
          // journey top = 100vh; desired portrait top = 7vh.
          y: () => vh() * 0.07 - vh() - portraitNaturalTop(),
        },
        {
          x: () => portraitStartX() * 0.68,
          // At 52% progress journey top = 48vh; desired portrait top = 11vh.
          y: () => vh() * 0.11 - vh() * 0.48 - portraitNaturalTop(),
          duration: 0.52,
          immediateRender: true,
        },
        0
      )
      .to(
        portrait,
        {
          x: 0,
          y: 0,
          duration: 0.48,
        },
        0.52
      );
  } else {
    /*
     * Reduced motion gets the readable final composition without a large
     * viewport-crossing flight. Other existing static layouts remain intact.
     */
    gsap.set(portrait, { x: 0, y: 0 });
  }

  // The frame settles from a slight tilt to the rectangular box the grid
  // gave it. Nothing here may reintroduce a shaped radius: the portrait is
  // meant to read as a plain picture in a column.
  tl
    .fromTo(
      ".story-photo-mask",
      { rotation: 2.5, width: "76%", filter: "grayscale(40%)" },
      { rotation: 0, width: "100%", filter: "grayscale(0%)", duration: settle, ease: "power1.inOut" },
      at.settle
    )
    .fromTo(".story-photo", { objectPosition: "50% 50%" }, { objectPosition: "50% 18%", duration: settle }, at.settle)
    .fromTo(
      ".story-credit",
      { scale: 0.01, autoAlpha: 0, rotation: 18 },
      { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.3, ease: "back.out(2)" },
      at.settle + 0.5
    )
    // The copy already sits in columns 7–12; it simply slides into its own
    // column from beyond the right edge, so no per-language offset is guessed.
    .fromTo(
      ".story-copy",
      { x: () => vw() },
      { x: 0, duration: approach, ease: "power2.out", immediateRender: false },
      at.approach
    )
    .fromTo(".copy-lead", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: approach * 0.6, ease: "power2.out" }, at.approach + approach * 0.2)
    .fromTo(".copy-body", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: approach * 0.6, ease: "power2.out" }, at.approach + approach * 0.4)
    .to(".story-layer", { x: () => -vw() * 1.08, duration: push, ease: "power1.inOut" }, at.push)
    // Soft parallax: the portrait lingers a touch behind the copy as both leave.
    .fromTo(".story-photo-box", { xPercent: 0 }, { xPercent: 12, duration: push, ease: "power1.in" }, at.push)
    .fromTo(".rail", { x: () => vw() }, { x: () => vw() * 0.06, duration: push, ease: "power1.inOut" }, at.push)
    .fromTo(".rail-image", { xPercent: 10 }, { xPercent: -10, duration: push + traverse + coda }, at.push)
    .to(".rail", { x: () => -(railWidth() - vw() * 0.62), duration: traverse }, at.traverse)
    .to(".rail", { x: () => -(railWidth() + vw() * 0.05), duration: coda, ease: "power1.in" }, at.coda)
    .fromTo(".coda", { x: 0 }, { x: () => -vw() * 0.95, duration: coda, ease: "power2.out" }, at.coda)
    .fromTo(
      ".coda-pic-1",
      {
        y: () => vh() * 0.16,
        clipPath: "inset(0% 100% 0% 0%)",
      },
      {
        y: 0,
        clipPath: "inset(0% 0% 0% 0%)",
        duration: coda * 0.9,
        ease: "power2.out",
      },
      at.coda + 0.08
    )
    .fromTo(
      ".coda-pic-2",
      {
        y: () => vh() * 0.24,
        clipPath: "inset(100% 0% 0% 0%)",
      },
      {
        y: 0,
        clipPath: "inset(0% 0% 0% 0%)",
        duration: coda * 0.85,
        ease: "power2.out",
      },
      at.coda + 0.18
    )
    .to(".coda-pic-1", { y: () => -vh() * 0.12, duration: outro }, at.outro)
    .to(".coda-pic-2", { y: () => -vh() * 0.22, duration: outro }, at.outro)
    .to(".coda-text", { y: () => -vh() * 0.04, duration: outro }, at.outro);

  // Reading light is motion: under `prefers-reduced-motion` the words are lit
  // by CSS instead (see the `.copy-word` rule in the reduced-motion block).
  if (!reduce) {
    lightWords(tl, ".story-copy .copy-body .copy-word", at.hold1 - approach * 0.2, hold1 + approach * 0.2);
    lightWords(tl, ".coda-text .copy-word", at.hold2 - coda * 0.3, hold2 + coda * 0.3);
  }

  tl
    // Black -> the photograph's night sky, from the gallery push to the coda.
    // Every journey layer paints the stage colour, so the ramp is painted on
    // each of them directly (see HANDOFF_PAINTED), and the timeline ends on
    // exactly the colour the works stage starts with: the hand-over has no seam.
    .fromTo(
      scope.querySelectorAll(HANDOFF_PAINTED),
      { backgroundColor: cssColor(scope, "--stage", "#000000") },
      { backgroundColor: cssColor(scope, "--sky", "#001c5c"), duration: total - at.push, ease: "sine.inOut" },
      at.push
    )
    .fromTo(
      handoffScope(scope),
      { "--handoff": cssColor(scope, "--stage", "#000000") },
      {
        "--handoff": cssColor(scope, "--sky", "#001c5c"),
        duration: total - at.push,
        ease: "sine.inOut",
      },
      at.push
    );
}

function journeyFlow(scope: HTMLElement, desktop: boolean, reduce: boolean, scrub: boolean | number, touch: boolean) {
  // Same colour hand-over as desktop, spread over the section's own scroll.
  const journey = scope.querySelector<HTMLElement>(".journey");
  if (journey) {
    gsap.fromTo(
      scope.querySelectorAll(HANDOFF_PAINTED),
      { backgroundColor: cssColor(scope, "--stage", "#000000") },
      {
        backgroundColor: cssColor(scope, "--sky", "#001c5c"),
        ease: "sine.inOut",
        scrollTrigger: { trigger: journey, start: "top 40%", end: "bottom bottom", scrub },
      }
    );
    gsap.fromTo(
      handoffScope(scope),
      { "--handoff": cssColor(scope, "--stage", "#000000") },
      {
        "--handoff": cssColor(scope, "--sky", "#001c5c"),
        ease: "sine.inOut",
        scrollTrigger: {
          trigger: journey,
          start: "top 40%",
          end: "bottom bottom",
          scrub,
        },
      }
    );
  }

  gsap.from(".story-photo-mask", {
    clipPath: "inset(100% 0% 0% 0%)",
    duration: 1.4,
    ease: "expo.out",
    scrollTrigger: { trigger: ".story-photo-box", start: "top 80%" },
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
      { opacity: 0.5 },
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
        pinType: pinType(),
        scrub,
        anticipatePin: touch ? 1 : 0,
        invalidateOnRefresh: true,
      },
    });
  }
}

type TvPhase = "rows" | "phone" | "exit";

/**
 * Smallest scale at which the glass — a rounded rectangle, `border-radius:
 * 10% / 11%` as drawn by `.tv-glass` — centred on (ox, oy) covers the viewport.
 */
function coverScale(ox: number, oy: number, sw: number, sh: number, vw: number, vh: number) {
  const hx = Math.max(ox, vw - ox);
  const hy = Math.max(oy, vh - oy);
  const covers = (s: number) => {
    const a = (s * sw) / 2;
    const b = (s * sh) / 2;
    if (hx > a || hy > b) return false;
    const rx = 0.2 * a;
    const ry = 0.22 * b;
    const dx = hx - (a - rx);
    const dy = hy - (b - ry);
    return dx <= 0 || dy <= 0 || (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
  };
  let lo = 1;
  let hi = 2;
  for (let i = 0; i < 24 && !covers(hi); i += 1) hi *= 2;
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2;
    if (covers(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * The set tunes to the call sign once the index has scrolled past (markup:
 * `sections.tsx#TvMessage`). Time-based rather than scrubbed, so the tube is
 * always doing something — power-on, flicker-in, the address typing out, a
 * blinking caret — instead of a frozen frame the reader has to scroll through.
 */
function createMessage(section: HTMLElement, reduce: boolean) {
  const rig = section.querySelector<HTMLElement>(".tv-msg-rig");
  const raster = section.querySelector<HTMLElement>(".tv-msg-raster");
  const flash = section.querySelector<HTMLElement>(".tv-msg-flash");
  const handle = section.querySelector<HTMLElement>(".tv-msg-handle");
  const mail = section.querySelector<HTMLElement>(".tv-msg-mail");
  const chars = gsap.utils.toArray<HTMLElement>(".tv-msg-char", section);
  if (!rig || !raster || !handle || !mail) return null;

  const typed = { n: 0 };
  let painted = -1;
  const paintTyping = () => {
    const n = Math.round(typed.n);
    if (n === painted) return;
    painted = n;
    chars.forEach((char, index) => char.classList.toggle("is-on", index < n));
    mail.style.setProperty("--typed", String(n));
    if (n > 0) mail.dataset.caret = "on";
    else delete mail.dataset.caret;
  };

  const tl = gsap.timeline({ paused: true });
  tl.fromTo(rig, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1, ease: "power1.out" }, 0)
    // CRT power-on: a dot, a line, then the raster opens vertically.
    .fromTo(raster, { scaleX: 0.03, scaleY: 0.006 }, { scaleX: 1, duration: 0.2, ease: "power3.out" }, 0)
    .to(raster, { scaleY: 1, duration: 0.32, ease: "expo.out" }, 0.18);
  if (flash) tl.fromTo(flash, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.55, ease: "power2.out" }, 0.12);
  tl.fromTo(
    handle,
    { autoAlpha: 0 },
    { keyframes: { autoAlpha: [0, 0.85, 0.25, 1], easeEach: "steps(1)" }, duration: 0.26, ease: "none" },
    0.42
  ).fromTo(typed, { n: 0 }, { n: chars.length, duration: chars.length * 0.034, ease: "none", onUpdate: paintTyping }, 0.66);

  return {
    on: () => {
      if (reduce) tl.progress(1);
      else tl.timeScale(1).play();
    },
    off: () => {
      if (reduce) tl.progress(0);
      // Reversed at speed it reads as the set switching off: the address
      // un-types and the raster collapses back to a line.
      else tl.timeScale(2.4).reverse();
    },
    kill: () => tl.kill(),
  };
}

/**
 * The dive through the glass into the contact section (the "zoom into the
 * hole" of thewhoopsies.co.uk, where the next section lives inside the
 * portal). `#contact` is real, live DOM: while it rises from the bottom edge
 * to the top it is mapped by a matrix into the television's screen and grows
 * with the camera, so the white page *on the tube* becomes the page itself —
 * no cross-fade, no white flash, no copy of the section. Everything is derived
 * from one number (the exit progress) and measured live, so the sheet stays
 * locked to the glass on any viewport.
 */
function createDive(scope: HTMLElement, section: HTMLElement) {
  const anchor = section.querySelector<HTMLElement>(".tv-anchor");
  const zoom = section.querySelector<HTMLElement>(".tv-zoom");
  const box = section.querySelector<HTMLElement>(".tv-box");
  const contact = scope.querySelector<HTMLElement>("#contact");
  const glass = scope.querySelector<HTMLElement>(".tv-glass");
  if (!anchor || !zoom || !box || !contact) return null;

  const css = getComputedStyle(anchor);
  const pct = (name: string, fallback: number) => {
    const value = parseFloat(css.getPropertyValue(name));
    return Number.isFinite(value) ? value / 100 : fallback;
  };
  const screen = {
    top: pct("--screen-top", 0.654),
    left: pct("--screen-left", 0.4262),
    width: pct("--screen-width", 0.1092),
    height: pct("--screen-height", 0.1198),
  };
  // Beats of the exit, as fractions of its scroll distance.
  const DIVE_FROM = 0.04;
  const DIVE_TO = 0.93;
  const diveEase = gsap.parseEase("power2.inOut");
  /** Where `#contact` comes to rest when the page ends before its top reaches the top edge. */
  let landing = 0;

  const clearContact = () => {
    contact.style.removeProperty("transform");
    contact.style.removeProperty("transform-origin");
    contact.style.removeProperty("clip-path");
  };
  const hideGlass = () => {
    if (glass) glass.style.visibility = "hidden";
  };

  const render = (u: number) => {
    if (u <= 0) {
      zoom.style.removeProperty("transform");
      clearContact();
      hideGlass();
      return;
    }
    // Reads first, then writes.
    const a = anchor.getBoundingClientRect();
    const contactTop = section.getBoundingClientRect().bottom;
    const contactHeight = contact.offsetHeight;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    const ox = a.left + a.width * (screen.left + screen.width / 2);
    const oy = a.top + a.height * (screen.top + screen.height / 2);
    const sw = a.width * screen.width;
    const sh = a.height * screen.height;
    const s0 = Number(gsap.getProperty(box, "scaleX")) || 1;
    const r0 = Number(gsap.getProperty(box, "rotation")) || 0;
    const full = coverScale(ox, oy, sw, sh, vw, vh) * 1.05;

    // Camera: geometric zoom (constant perceived speed) from the lean-in to
    // "the glass covers the viewport", straightening the lean on the way in.
    const z = diveEase(gsap.utils.clamp(0, 1, (u - DIVE_FROM) / (DIVE_TO - DIVE_FROM)));
    const s = Math.pow(full / s0, z);
    const rho = -r0 * z;
    zoom.style.transform = `rotate(${rho.toFixed(4)}deg) scale(${s.toFixed(5)})`;

    if (u >= 1) {
      // Landed: the section is back in the flow, untransformed and interactive.
      clearContact();
      hideGlass();
      return;
    }

    // Sheet: the same similarity transform as the set, relative to its final
    // pose, so it lands at scale 1 exactly when the glass covers the viewport.
    const S = s0 * s;
    const c = S / full;
    const angle = ((r0 + rho) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const qx = -ox;
    const qy = landing - oy;
    const e = ox + c * (cos * qx - sin * qy);
    const f = oy + c * (sin * qx + cos * qy) - contactTop;
    contact.style.transformOrigin = "0 0";
    contact.style.transform = `matrix(${(c * cos).toFixed(6)}, ${(c * sin).toFixed(6)}, ${(-c * sin).toFixed(6)}, ${(c * cos).toFixed(6)}, ${e.toFixed(2)}, ${f.toFixed(2)})`;
    // Only the first screenful is on the tube, with the glass's round corners.
    const below = Math.max(0, contactHeight - (vh - landing));
    const rx = 0.1 * sw * full * (1 - z);
    const ry = 0.11 * sh * full * (1 - z);
    contact.style.clipPath = `inset(0px 0px ${below.toFixed(1)}px 0px round ${rx.toFixed(1)}px / ${ry.toFixed(1)}px)`;

    if (glass) {
      // Scanlines, vignette and glare over the sheet while it is still a
      // picture on the tube; they thin out as the camera passes the glass.
      const gx = a.left + a.width * screen.left;
      const gy = a.top + a.height * screen.top;
      const fadeIn = gsap.utils.clamp(0, 1, (u - 0.02) / 0.05);
      const fadeOut = 1 - gsap.utils.clamp(0, 1, (z - 0.28) / 0.42);
      glass.style.visibility = "visible";
      glass.style.width = `${sw.toFixed(2)}px`;
      glass.style.height = `${sh.toFixed(2)}px`;
      glass.style.transformOrigin = `${(ox - gx).toFixed(2)}px ${(oy - gy).toFixed(2)}px`;
      glass.style.transform = `translate(${gx.toFixed(2)}px, ${gy.toFixed(2)}px) rotate(${(r0 + rho).toFixed(4)}deg) scale(${S.toFixed(5)})`;
      glass.style.opacity = Math.min(fadeIn, fadeOut).toFixed(3);
    }
  };

  return {
    contact,
    measure: (self: ScrollTrigger) => {
      landing = Math.max(0, window.innerHeight - (self.end - self.start));
    },
    render,
    reset: () => {
      zoom.style.removeProperty("transform");
      clearContact();
      if (glass) glass.removeAttribute("style");
    },
  };
}

function television(scope: HTMLElement, opts: ChoreographyOptions, desktop: boolean, reduce: boolean) {
  const section = scope.querySelector<HTMLElement>("#works");
  if (!section) return;
  const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  let phase: TvPhase = "rows";
  const setPhase = (next: TvPhase) => {
    phase = next;
    if (section.dataset.theaterLayout) return;
    section.dataset.tvPhase = next;
  };
  setPhase("rows");

  // The set stays in frame until the contact sheet has fully risen over it —
  // through the message and the whole dive into the glass.
  ScrollTrigger.create({
    trigger: ".tv-stage",
    start: "top top",
    endTrigger: "#contact",
    end: "clamp(top top)",
    pin: true,
    pinType: pinType(),
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

  // The coda leaves as the night arrives. Skipped outright under reduced
  // motion: that preference asks for no motion, not the same motion shorter.
  if (!reduce) {
    gsap.to(".coda", {
      yPercent: -12,
      autoAlpha: 0,
      ease: "none",
      scrollTrigger: { trigger: section, start: "top 85%", end: "top 35%", scrub: true },
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
      start: "top 78%",
      // Ends exactly where the dive starts: `#contact` touching the bottom edge.
      end: "bottom bottom",
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

  // The set is framed whole, so this beat travels further than the old 1.14
  // lean: the anchor lifts the screen to the optical centre while the box leans
  // in. The message reads during the second half, where the camera keeps
  // creeping in — the old version parked a still frame for over a screen of
  // scrolling, which read as the page having frozen.
  phoneTl
    .to(".tv-anchor", { y: () => screenLift(section), duration: 0.52, ease: "sine.inOut" }, 0)
    .to(".tv-box", { scale: lean, rotation: -1.5, duration: 0.52, ease: "sine.inOut" }, 0)
    .fromTo(".tv-scrim, .tv-seam", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.24, immediateRender: false }, 0)
    .to(".tv-box", { scale: lean * 1.05, rotation: -1.8, duration: 0.48 }, 0.52);

  const message = createMessage(section, reduce);
  if (message) {
    ScrollTrigger.create({
      trigger: ".tv-phone-spacer",
      start: desktop ? "top 45%" : "top 48%",
      endTrigger: "#contact",
      end: "bottom bottom",
      onEnter: message.on,
      onLeaveBack: message.off,
    });
  }

  // Exit: the dive through the glass. It runs while `#contact` rises from the
  // bottom edge to the top (no spacer of its own), and lands on the sheet.
  const dive = reduce ? null : createDive(scope, section);
  const exitTl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: "#contact",
      start: "top bottom",
      end: "clamp(top top)",
      scrub: true,
      invalidateOnRefresh: true,
      onEnter: () => setPhase("exit"),
      onLeaveBack: () => setPhase("phone"),
      onRefresh: (self) => dive?.measure(self),
    },
  });

  if (dive) {
    // 1. The set changes channel: a burst of snow, then the white contact page
    //    is on the tube (the sheet itself, mapped into the glass by `dive`).
    // 2. The camera dives until the glass covers the viewport; the sheet grows
    //    with it and lands at scale 1 — the hand-over has no seam to hide.
    const progress = { u: 0 };
    exitTl
      .fromTo(
        ".tv-msg-static",
        { autoAlpha: 0 },
        { keyframes: { autoAlpha: [0, 0.95, 0.75, 0] }, duration: 0.07 },
        0
      )
      .fromTo(".tv-msg-portal", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.03 }, 0.028)
      .fromTo(dive.contact, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.035 }, 0.028)
      .fromTo(progress, { u: 0 }, { u: 1, duration: 1, onUpdate: () => dive.render(progress.u) }, 0);
  }

  // Resolve phase once after all callbacks, including jumps backwards across
  // several beats. Callback registration order must not leave rows unclickable.
  const syncPhase = () => {
    const phone = phoneTl.scrollTrigger;
    const exit = exitTl.scrollTrigger;
    if (!phone || !exit) return;
    const y = phone.scroll();
    setPhase(y < phone.start ? "rows" : y < exit.start ? "phone" : "exit");
  };
  ScrollTrigger.create({ trigger: section, start: "top bottom", endTrigger: "#contact", end: "bottom top", onUpdate: syncPhase, onRefresh: syncPhase });

  return () => {
    message?.kill();
    dive?.reset();
  };
}

function contact(scope: HTMLElement, desktop: boolean, reduce: boolean) {
  const rows = gsap.utils.toArray<HTMLElement>(".contact-reel-row", scope);
  if (reduce) {
    gsap.set(
      ".contact-booth, .contact-booth-shadow, .contact-reel-row, .contact-cta-label, .contact-mail-text, .contact-mail-arrow, .contact-cta .contact-item, .contact-footer > *",
      { autoAlpha: 1, clearProps: "transform" }
    );
    return;
  }
  const vw = () => window.innerWidth;
  const vh = () => window.innerHeight;

  // Arrival, scrubbed with the dive (the same scroll range): while the sheet is
  // still a picture on the tube the bands slide in from opposite edges and the
  // booth rises onto its mark. Kept short and gentle so the page reads as
  // composed well before the camera passes the glass.
  const arrive = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: "#contact", start: "top 100%", end: "clamp(top top)", scrub: 0.6, invalidateOnRefresh: true },
  });
  rows.forEach((row, index) => {
    arrive.fromTo(row, { x: () => vw() * (index % 2 ? -0.18 : 0.18) }, { x: 0, duration: 0.7, ease: "power3.out" }, 0);
  });
  arrive
    .fromTo(
      ".contact-booth",
      { autoAlpha: 0, y: () => vh() * 0.1, scale: 0.9, rotation: desktop ? -2 : 0, transformOrigin: "50% 100%" },
      { autoAlpha: 1, y: 0, scale: 1, rotation: 0, duration: 0.55, ease: "power3.out" },
      0.05
    )
    .fromTo(".contact-booth-shadow", { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: "power2.out" }, 0.3)
    // Rest of the dive: nothing left to arrive, the sheet just lands.
    .to({}, { duration: 0.3 }, 0.7);

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

/** The intro's own photographs must be fetched and decoded before the pin is
 *  measured. A late lazy load used to fire `ScrollTrigger.refresh()` while the
 *  reader was already flinging through the section — the pin re-measured, the
 *  page jumped, and the rail appeared to shake. Only these images are awaited;
 *  later loads elsewhere on the page must never refresh the intro again. */
const JOURNEY_MEDIA_SELECTOR = ".story-photo, .rail-image";

function waitForJourneyMedia(scope: HTMLElement, signal: AbortSignal): Promise<void> {
  const images = Array.from(scope.querySelectorAll<HTMLImageElement>(JOURNEY_MEDIA_SELECTOR));
  return Promise.all(
    images.map(async (img) => {
      if (!img.complete) {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true, signal });
          img.addEventListener("error", done, { once: true, signal });
        });
      }
      if (typeof img.decode === "function") {
        await img.decode().catch(() => undefined);
      }
    })
  ).then(() => undefined);
}

export function setupChoreography(opts: ChoreographyOptions) {
  registerGsap();
  const { scope } = opts;
  const mm = gsap.matchMedia(scope);

  mm.add(
    { desktop: DESKTOP_QUERY, mobile: MOBILE_QUERY, journeyPinned: JOURNEY_PINNED_QUERY, touch: TOUCH_QUERY, reduce: REDUCED_QUERY },
    (context) => {
      const { desktop, journeyPinned, touch, reduce } = context.conditions as Conditions;
      const introScrub: boolean | number = reduce ? true : touch ? INTRO_TOUCH_SCRUB : true;
      heroScroll(desktop);
      if (journeyPinned) journeyDesktop(scope, reduce, introScrub);
      else journeyFlow(scope, desktop, reduce, introScrub, touch);
      const tvCleanup = television(scope, opts, desktop, reduce);
      contact(scope, desktop, reduce);
      sectionTracking(opts);
      // The dive writes matrices straight to the DOM (not through tweens), so
      // they are cleared by hand when the context reverts (resize, language).
      return () => tvCleanup?.();
    }
  );

  let disposed = false;
  let refreshTimer = 0;
  const refresh = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      if (!disposed) ScrollTrigger.refresh();
    }, 120);
  };
  const mediaAbort = new AbortController();
  void Promise.all([
    document.fonts?.ready ?? Promise.resolve(),
    waitForJourneyMedia(scope, mediaAbort.signal),
  ]).then(() => {
    if (!disposed) refresh();
  });
  refresh();

  return () => {
    disposed = true;
    mediaAbort.abort();
    window.clearTimeout(refreshTimer);
    resetPinType();
    mm.revert();
  };
}
