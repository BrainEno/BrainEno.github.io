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

import { gsap } from "gsap";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from "react";
import { t } from "../content/normalize";
import type { Language, PortfolioContent, SectionId } from "../content/types";
import {
  createHeroEntrance,
  createLoader,
  createSmoother,
  prefersReducedMotion,
  registerGsap,
  scrollToSection,
  setupChoreography,
} from "../scroll/choreography";
import { openTheater, type TheaterHandle } from "../scroll/theater";
import { cx } from "./cx";
import { Contact, Hero, Journey, Works } from "./sections";

const LANG_KEY = "pf-lang";
const subscribeNever = () => () => {};
const readStoredLang = () => (typeof window === "undefined" ? null : window.localStorage.getItem(LANG_KEY));
const SEEN_KEY = "pf-preloaded";
const SECTIONS: SectionId[] = ["intro", "works", "contact"];

type HeaderProps = {
  name: string;
  lang: Language;
  section: SectionId;
  navigation: PortfolioContent["navigation"];
  onLanguage: (lang: Language) => void;
  onNavigate: (section: SectionId) => void;
};

const Header = memo(function Header({ name, lang, section, navigation, onLanguage, onNavigate }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <a
          href="#intro"
          className="header-item header-name"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("intro");
          }}
        >
          {name}
        </a>
        <div className="header-item lang-switch" role="group" aria-label="Language">
          {(["zh", "en"] as const).map((code, index) => (
            <span key={code} className="lang-option">
              {index > 0 ? <span className="lang-divider" aria-hidden="true">|</span> : null}
              <button
                type="button"
                className={cx("lang", lang === code && "is-selected")}
                aria-pressed={lang === code}
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  // Keep the pointer from selecting the label, but do not move
                  // focus: a scripted focus after a click is what makes Chrome
                  // paint the accent ring over the masthead as an orange box.
                  event.preventDefault();
                }}
                onClick={() => onLanguage(code)}
              >
                <span className="lang-long">{code === "zh" ? "中文" : "English"}</span>
                <span className="lang-short">{code === "zh" ? "Zh" : "En"}</span>
              </button>
            </span>
          ))}
        </div>
      </div>
      <nav className="nav" aria-label="Sections">
        {SECTIONS.map((id) => (
          <button
            key={id}
            type="button"
            className={cx("header-item nav-entry", section === id && "is-active")}
            aria-current={section === id ? "true" : undefined}
            onClick={() => onNavigate(id)}
            data-cursor="link"
          >
            <span className="nav-pill" aria-hidden="true" />
            <span className="nav-roll" data-text={t(navigation[id], lang)}>
              <span>{t(navigation[id], lang)}</span>
            </span>
          </button>
        ))}
      </nav>
    </header>
  );
});

/**
 * The loading screen: a CRT tuning to the wordmark. Four stacked copies of the
 * name — a dark ghost, the phosphor pass the scan reveals, and the red / cyan
 * guns that slip on lock. The flood is a *sibling*: white with the letters
 * punched out, so the camera can dive through the stem of the "I" into the
 * page behind it. Choreography lives in `scroll/choreography.ts#createLoader`.
 */
function Preloader({ name }: { name: string }) {
  const letters = Array.from(name.toUpperCase().replace(/\s+/g, ""));
  // The pivot is the stem the dive is aimed at: the "I" of BRAINENO.
  const pivot = 3;
  return (
    <>
      <div className="preloader" aria-hidden="true">
        <div className="preloader-stretch">
          <div className="preloader-word">
            <span className="preloader-word-ghost">{name}</span>
            <span className="preloader-word-lit">{name}</span>
            <span className="preloader-word-r">{name}</span>
            <span className="preloader-word-c">{name}</span>
          </div>
          <div className="preloader-beam" />
          <div className="preloader-wipe" />
          <span className="preloader-count">000</span>
        </div>
      </div>
      <div className="preloader-flood" aria-hidden="true">
        <span className="preloader-mark">
          {letters.slice(0, pivot).join("")}
          <span className="is-pivot">{letters[pivot] ?? "I"}</span>
          {letters.slice(pivot + 1).join("")}
        </span>
      </div>
    </>
  );
}

function Cursor({
  onHoverWork,
  syncRef,
}: {
  onHoverWork: (index: number) => void;
  syncRef: RefObject<(() => void) | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      syncRef.current = null;
      return;
    }
    const xTo = gsap.quickTo(el, "x", { duration: 0.45, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.45, ease: "power3" });
    let visible = false;
    let pointerX = 0;
    let pointerY = 0;

    const evaluateTarget = (element: Element | null) => {
      const target = element?.closest<HTMLElement>("[data-cursor], a, button");
      el.dataset.state = target?.dataset.cursor ?? (target ? "link" : "");

      const worksSection = document.getElementById("works");
      const inRowsPhase = !worksSection?.dataset.tvPhase || worksSection.dataset.tvPhase === "rows";
      const row = inRowsPhase ? element?.closest<HTMLElement>(".work-row[data-work-index]") : null;
      if (row) {
        onHoverWork(Number(row.dataset.workIndex));
      } else if (inRowsPhase && element?.closest(".tv-video")) {
        // Allow clicking a video work directly on the CRT tube without powering it off mid-click.
      } else if (!document.activeElement?.closest(".work-row")) {
        onHoverWork(-1);
      }
    };

    syncRef.current = () => {
      if (!visible) return;
      evaluateTarget(document.elementFromPoint(pointerX, pointerY));
    };

    const onMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!visible) {
        visible = true;
        gsap.set(el, { x: pointerX, y: pointerY });
        gsap.to(el, { autoAlpha: 1, duration: 0.3 });
      }
      xTo(pointerX);
      yTo(pointerY);
      evaluateTarget(event.target as Element | null);
    };
    const onLeave = () => {
      visible = false;
      gsap.to(el, { autoAlpha: 0, duration: 0.3 });
      if (!document.activeElement?.closest(".work-row")) onHoverWork(-1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      syncRef.current = null;
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [onHoverWork, syncRef]);

  return <div ref={ref} className="cursor" aria-hidden="true"><span className="cursor-dot" /></div>;
}

/** The index page: content is exactly what the build baked in. */
export default function Portfolio({ content }: { content: PortfolioContent }) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const lastWorkRef = useRef(-1);
  const syncPointerRef = useRef<(() => void) | null>(null);
  // Language preference: the stored value is read as an external store rather
  // than copied into state from an effect (which would render the wrong
  // language for a frame, and fights hydration).
  const [langOverride, setLangOverride] = useState<Language | null>(null);
  const storedLang = useSyncExternalStore(subscribeNever, readStoredLang, () => null);
  const lang: Language = langOverride ?? (storedLang === "zh" || storedLang === "en" ? storedLang : content.identity.defaultLanguage);
  const [section, setSection] = useState<SectionId>("intro");
  const [activeWork, setActiveWork] = useState(-1);
  const [theaterWork, setTheaterWork] = useState(-1);
  // The sheet outlives the theater by one exit animation (see `closeWork`).
  const [sheetWork, setSheetWork] = useState(-1);
  const theaterRef = useRef<TheaterHandle | null>(null);
  const closingRef = useRef<Promise<void> | null>(null);
  const layoutDirtyRef = useRef(false);
  // The dialog owns the camera until it closes. Translating its copy must not
  // revert the scroll context underneath that camera or overwrite its phase.
  const [theaterLanguage, setTheaterLanguage] = useState<Language | null>(null);
  const layoutLanguage = theaterLanguage ?? lang;
  const theaterIndexRef = useRef(-1);
  const shownTheaterRef = useRef(-1);
  /** Scroll progress (0–1) carried across a choreography rebuild. */
  const scrollMemoryRef = useRef<{ progress: number; worksTop: number | null } | null>(null);
  const stepDirectionRef = useRef<1 | -1>(1);
  const [layoutKey, setLayoutKey] = useState(0);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
    document.title = t(content.identity.pageTitle, lang) || content.identity.name;
  }, [lang, content.identity]);

  // Focus rings belong to keyboards only. Several controls here are focused
  // from a pointer-down (the language switch, the index rows, the sheet
  // navigation) so their own scroll handling wins; Chrome then treats the
  // scripted focus as visible and paints the accent ring as an orange box over
  // the page. The mode is tracked here and the stylesheet draws the ring only
  // while `data-input="keys"`.
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") scope.dataset.input = "keys";
    };
    const onPointer = () => {
      scope.dataset.input = "pointer";
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, []);

  const changeLanguage = useCallback((next: Language) => {
    setLangOverride(next);
    window.localStorage.setItem(LANG_KEY, next);
  }, []);

  const preview = useCallback((index: number) => {
    // While a project is screening, the tube belongs to it: hover/scroll
    // tuning from the (hidden) index is ignored until the theater closes.
    if (theaterIndexRef.current >= 0) return;
    if (index >= 0) lastWorkRef.current = index;
    setActiveWork((current) => (current === index ? current : index));
  }, []);

  const workCount = content.works.items.length;

  const openWork = useCallback((index: number) => {
    const section = scopeRef.current?.querySelector<HTMLElement>("#works");
    if (!section || closingRef.current || index < 0 || index >= workCount) return;
    if (theaterIndexRef.current < 0) {
      const phase = section.dataset.tvPhase;
      if (phase && phase !== "rows") return;
      setTheaterLanguage(lang);
    }
    theaterIndexRef.current = index;
    lastWorkRef.current = index;
    setTheaterWork(index);
    setSheetWork(index);
    setActiveWork(index);
  }, [workCount, lang]);

  // The sheet is rendered by the state change above; the zoom timeline is
  // built right after that commit so it can find the sheet's text to reveal.
  // Switching projects inside the theater only remounts the keyed project
  // copy; `swap` reveals it while the nav (prev / next / close) stays put.
  useLayoutEffect(() => {
    const previous = shownTheaterRef.current;
    shownTheaterRef.current = theaterWork;
    if (theaterWork < 0) return;
    if (theaterRef.current) {
      if (previous >= 0 && previous !== theaterWork) theaterRef.current.swap(stepDirectionRef.current);
      else if (!closingRef.current) theaterRef.current.relabel();
      return;
    }
    const section = scopeRef.current?.querySelector<HTMLElement>("#works");
    if (!section) return;
    const handle = openTheater(section);
    if (!handle) {
      theaterIndexRef.current = -1;
      setTheaterWork(-1);
      setSheetWork(-1);
      setTheaterLanguage(null);
      return;
    }
    theaterRef.current = handle;
  }, [theaterWork, lang]);

  const closeWork = useCallback(() => {
    if (closingRef.current) return closingRef.current;
    const handle = theaterRef.current;
    if (!handle) return Promise.resolve();
    const closing = handle.close().then(() => {
      if (theaterRef.current !== handle) return;
      theaterRef.current = null;
      closingRef.current = null;
      theaterIndexRef.current = -1;
      setTheaterWork(-1);
      setSheetWork(-1);
      setActiveWork(-1);
      setTheaterLanguage(null);
      if (layoutDirtyRef.current) {
        layoutDirtyRef.current = false;
        setLayoutKey((key) => key + 1);
      }
      scopeRef.current?.querySelector<HTMLElement>(`.work-row[data-work-index="${lastWorkRef.current}"]`)?.focus({ preventScroll: true });
      syncPointerRef.current?.();
    });
    closingRef.current = closing;
    return closing;
  }, []);

  useEffect(() => () => {
    const handle = theaterRef.current;
    theaterRef.current = null;
    closingRef.current = null;
    handle?.dispose();
  }, []);

  const stepWork = useCallback(
    (delta: 1 | -1) => {
      const current = theaterIndexRef.current;
      if (current < 0 || closingRef.current) return;
      stepDirectionRef.current = delta;
      openWork((current + delta + workCount) % workCount);
    },
    [openWork, workCount]
  );

  // Keyboard: Esc leaves the theater, arrows change project; resize re-fits
  // the glass to the new stage.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (theaterIndexRef.current < 0) return;
      if (event.key === "Escape") closeWork();
      else if (event.key === "ArrowRight") stepWork(1);
      else if (event.key === "ArrowLeft") stepWork(-1);
    };
    const onResize = () => theaterRef.current?.refit();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [closeWork, stepWork]);

  const navigate = useCallback((id: SectionId) => {
    void closeWork().then(() => {
      window.requestAnimationFrame(() => {
        setSection(id);
        scrollToSection(id);
      });
    });
  }, [closeWork]);

  useEffect(() => {
    let width = window.innerWidth;
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (Math.abs(window.innerWidth - width) < 2) return;
        width = window.innerWidth;
        if (theaterIndexRef.current >= 0) {
          layoutDirtyRef.current = true;
          theaterRef.current?.refit();
          return;
        }
        setLayoutKey((key) => key + 1);
      }, 250);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    registerGsap();
    const smoother = createSmoother();
    const scope = scopeRef.current;
    if (!scope) return;
    const preloader = scope.querySelector<HTMLElement>(".preloader");
    const flood = scope.querySelector<HTMLElement>(".preloader-flood");
    const heroImage = scope.querySelector<HTMLImageElement>(".hero-photo");
    const entrance = createHeroEntrance();
    // The loader is never unmounted: it is parked outside the flow once done.
    const hideLoader = () => {
      if (preloader) preloader.style.display = "none";
      if (flood) flood.style.display = "none";
    };

    // Reduced motion means *no* motion, not the same motion, quicker. The two
    // pieces that cannot be made "short enough" are the full-screen loading
    // overlay and the 1.5 s hero reveal, so both are skipped: the page is just
    // there, already in its final pose. Scroll choreography, the booth and the
    // television each check the same media query on their own.
    if (prefersReducedMotion()) {
      hideLoader();
      entrance.progress(1);
      smoother.paused(false);
      return () => {
        entrance.revert();
        ScrollSmoother.get()?.kill();
      };
    }

    const quick = window.sessionStorage.getItem(SEEN_KEY) === "1";
    smoother.paused(true);
    // A repeat visit in the same session halves every beat; the ready promise
    // still gates the finish, so the loader never ends before the page is up.
    const loader = preloader && flood ? createLoader(preloader, flood, quick) : null;
    const intro = loader?.intro ?? gsap.timeline();

    const ready = Promise.race([
      Promise.all([
        document.fonts?.ready ?? Promise.resolve(),
        heroImage?.decode().catch(() => undefined) ?? Promise.resolve(),
      ]),
      new Promise((resolve) => window.setTimeout(resolve, 3200)),
    ]);

    let outro: gsap.core.Timeline | undefined;
    let cancelled = false;
    void ready.then(() => {
      if (cancelled) return;
      const delay = intro.isActive() ? intro.duration() - intro.time() : 0;
      if (!loader) {
        entrance.play();
        smoother.paused(false);
        window.sessionStorage.setItem(SEEN_KEY, "1");
        hideLoader();
        return;
      }
      // The hero entrance starts while the camera is still inside the "I", so
      // the dive lands on a page that is already arriving.
      outro = loader.reveal({
        delay,
        entrance: () => entrance.play(),
        done: () => {
          smoother.paused(false);
          window.sessionStorage.setItem(SEEN_KEY, "1");
          hideLoader();
        },
      });
    });

    return () => {
      cancelled = true;
      intro.kill();
      outro?.kill();
      entrance.revert();
      smoother.paused(false);
      ScrollSmoother.get()?.kill();
    };
  }, []);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const teardown = setupChoreography({
      scope,
      onSection: setSection,
      onWork: preview,
      lastWork: () => lastWorkRef.current,
      syncPointer: () => syncPointerRef.current?.(),
    });
    // Rebuilding the choreography (language switch, resize) first reverts every
    // pin, which collapses the pin spacing and clamps the scroll position — the
    // page used to land thousands of pixels away from where the reader was, and
    // the focus-scroll of the next click then hit the wrong row. Put the reader
    // back at the same relative progress once the new pins are measured.
    const resume = scrollMemoryRef.current;
    scrollMemoryRef.current = null;
    let frame = 0;
    if (resume !== null) {
      frame = window.requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        const smoother = ScrollSmoother.get();
        const list = scope.querySelector<HTMLElement>(".works-list");
        const target = resume.worksTop !== null && list
          ? (smoother?.offset(list, "top top") ?? list.getBoundingClientRect().top + window.scrollY) - resume.worksTop
          : resume.progress * ScrollTrigger.maxScroll(window);
        if (smoother) smoother.scrollTop(target);
        else window.scrollTo(0, target);
      });
    }
    return () => {
      window.cancelAnimationFrame(frame);
      const max = ScrollTrigger.maxScroll(window);
      const y = ScrollSmoother.get()?.scrollTop() ?? window.scrollY;
      const works = scope.querySelector<HTMLElement>("#works")?.getBoundingClientRect();
      const list = scope.querySelector<HTMLElement>(".works-list");
      scrollMemoryRef.current = max > 0 ? {
        progress: Math.min(1, Math.max(0, y / max)),
        worksTop: works && works.top <= 0 && works.bottom > window.innerHeight && list ? list.getBoundingClientRect().top : null,
      } : null;
      teardown();
    };
    // `layoutKey` bumps on a viewport-size change: the choreography measures the
    // DOM, so it has to be rebuilt against the new geometry.
  }, [layoutLanguage, layoutKey, preview]);

  const themeStyle = {
    "--accent": content.theme.accent,
    "--stage": content.theme.stage,
  } as CSSProperties;

  return (
    <div ref={scopeRef} className={cx("pf", lang === "zh" && "lang-zh")} style={themeStyle}>
      <Preloader name={content.identity.name} />
      {/* The glass the dive passes through: positioned every frame by
          `createDive`, invisible until the sheet is on the tube. */}
      <div className="tv-glass" aria-hidden="true" />
      <Cursor onHoverWork={preview} syncRef={syncPointerRef} />
      <Header
        name={content.identity.name}
        lang={lang}
        section={section}
        navigation={content.navigation}
        onLanguage={changeLanguage}
        onNavigate={navigate}
      />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main>
            <Hero lang={lang} content={content.hero} name={content.identity.name} />
            <Journey lang={lang} content={content.intro} name={content.identity.name} />
            <Works
              lang={lang}
              content={content.works}
              email={content.contact.email}
              activeIndex={activeWork}
              theaterIndex={theaterWork}
              sheetIndex={sheetWork}
              onPreview={preview}
              onOpen={openWork}
              onClose={closeWork}
              onStep={stepWork}
            />
            <Contact lang={lang} content={content.contact} />
          </main>
        </div>
      </div>
    </div>
  );
}
