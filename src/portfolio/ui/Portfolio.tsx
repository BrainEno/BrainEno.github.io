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
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from "react";
import { t } from "../content/normalize";
import type { Language, PortfolioContent, SectionId } from "../content/types";
import {
  createHeroEntrance,
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

function Preloader({ name }: { name: string }) {
  return (
    <div className="preloader" aria-hidden="true">
      <div className="preloader-inner">
        <span className="preloader-mask"><span className="preloader-name">{name}</span></span>
        <span className="preloader-mask"><span className="preloader-count">000</span></span>
      </div>
      <div className="preloader-bar"><span className="preloader-bar-fill" /></div>
    </div>
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
  const theaterRef = useRef<TheaterHandle | null>(null);
  const theaterIndexRef = useRef(-1);
  const [layoutKey, setLayoutKey] = useState(0);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
    document.title = t(content.identity.pageTitle, lang) || content.identity.name;
  }, [lang, content.identity]);

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
    if (!section || index < 0 || index >= workCount) return;
    if (theaterIndexRef.current < 0) {
      const phase = section.dataset.tvPhase;
      if (phase && phase !== "rows") return;
    }
    theaterIndexRef.current = index;
    lastWorkRef.current = index;
    setTheaterWork(index);
    setActiveWork(index);
  }, [workCount]);

  // The sheet is rendered by the state change above; the zoom timeline is
  // built right after that commit so it can find the sheet's text to reveal.
  useLayoutEffect(() => {
    if (theaterWork < 0 || theaterRef.current) return;
    const section = scopeRef.current?.querySelector<HTMLElement>("#works");
    if (!section) return;
    const handle = openTheater(section);
    if (!handle) {
      theaterIndexRef.current = -1;
      setTheaterWork(-1);
      return;
    }
    theaterRef.current = handle;
  }, [theaterWork]);

  const closeWork = useCallback(() => {
    const handle = theaterRef.current;
    if (!handle) return;
    theaterRef.current = null;
    theaterIndexRef.current = -1;
    setTheaterWork(-1);
    void handle.close().then(() => {
      // Back on the index: the tube returns to the untouched set unless the
      // pointer is still parked on a row (the cursor re-syncs on its own).
      setActiveWork(-1);
      syncPointerRef.current?.();
    });
  }, []);

  const stepWork = useCallback(
    (delta: 1 | -1) => {
      const current = theaterIndexRef.current;
      if (current < 0) return;
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
    setSection(id);
    scrollToSection(id);
  }, []);

  useEffect(() => {
    let width = window.innerWidth;
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (Math.abs(window.innerWidth - width) < 2 || theaterIndexRef.current >= 0) return;
        width = window.innerWidth;
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
    const count = scope.querySelector<HTMLElement>(".preloader-count");
    const heroImage = scope.querySelector<HTMLImageElement>(".hero-photo");
    const entrance = createHeroEntrance();

    // Reduced motion means *no* motion, not the same motion, quicker. The two
    // pieces that cannot be made "short enough" are the full-screen loading
    // overlay and the 1.5 s hero reveal, so both are skipped: the page is just
    // there, already in its final pose. Scroll choreography, the booth and the
    // television each check the same media query on their own.
    if (prefersReducedMotion()) {
      if (preloader) preloader.style.display = "none";
      entrance.progress(1);
      smoother.paused(false);
      return () => {
        entrance.revert();
        ScrollSmoother.get()?.kill();
      };
    }

    const quick = window.sessionStorage.getItem(SEEN_KEY) === "1";
    const counter = { value: 0 };
    const renderCount = () => {
      if (count) count.textContent = String(Math.round(counter.value)).padStart(3, "0");
    };

    smoother.paused(true);
    const intro = gsap.timeline();
    intro
      .to(counter, { value: 82, duration: quick ? 0.35 : 1.3, ease: "power2.inOut", onUpdate: renderCount })
      .to(".preloader-bar-fill", { scaleX: 0.82, duration: quick ? 0.35 : 1.3, ease: "power2.inOut" }, 0);

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
      outro = gsap.timeline({ delay: intro.isActive() ? intro.duration() - intro.time() : 0 });
      outro
        .to(counter, { value: 100, duration: 0.45, ease: "power2.out", onUpdate: renderCount })
        .to(".preloader-bar-fill", { scaleX: 1, duration: 0.45, ease: "power2.out" }, "<")
        .to(".preloader-mask > *", { yPercent: -110, duration: 0.6, ease: "expo.in", stagger: 0.05 })
        .to(".preloader", { yPercent: -100, duration: 1.05, ease: "expo.inOut" }, "-=0.15")
        .add(() => entrance.play(), "-=0.6")
        .add(() => {
          smoother.paused(false);
          window.sessionStorage.setItem(SEEN_KEY, "1");
          if (preloader) preloader.style.display = "none";
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
    return teardown;
    // `layoutKey` bumps on a viewport-size change: the choreography measures the
    // DOM, so it has to be rebuilt against the new geometry.
  }, [lang, layoutKey, preview]);

  const themeStyle = {
    "--accent": content.theme.accent,
    "--stage": content.theme.stage,
  } as CSSProperties;

  return (
    <div ref={scopeRef} className={cx("pf", lang === "zh" && "lang-zh")} style={themeStyle}>
      <Preloader name={content.identity.name} />
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
            <Journey lang={lang} content={content.intro} />
            <Works
              lang={lang}
              content={content.works}
              phone={content.contact.phone}
              activeIndex={activeWork}
              theaterIndex={theaterWork}
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
