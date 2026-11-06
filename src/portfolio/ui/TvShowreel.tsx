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
import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalizedText } from "../content/types";
import { asset } from "../seo/asset";
import { Img, srcSetFor } from "./Img";

export type TvWork = {
  id: string;
  src: string;
  alt: LocalizedText;
  /** Present when the work has a video — the TV plays it instead of showing a still. */
  videoSrc?: string;
  /** Poster shown before playback; falls back to `src` when omitted. */
  videoPoster?: string;
};

type Props = {
  /** The work the page wants on screen; `null` returns to the untouched `tv.webp`. */
  active: TvWork | null;
  /** Photoshop alpha-cutout frame (`tv-alpha.webp`) layered above `.tv-screen`. */
  alphaSrc: string;
  frameWidth: number;
  frameHeight: number;
  /** Alt text for the current language. */
  label: (text: LocalizedText) => string;
  /** Theater presentation mode: stills drift slowly while enlarged.
   *  Video works autoplay whenever they are the active channel; this flag
   *  only delays theater playback until the opening move has settled. */
  autoplay?: boolean;
};

const RESTING_FILTER = "saturate(1.06) contrast(1.04) brightness(0.93)";

/**
 * Active CRT channel rig for the television in the works section.
 *
 * When `active` is `null` (no work hovered, or after scrolling past the works
 * list), the entire rig stays at `opacity: 0` so the base `tv.webp` photograph
 * shows completely untouched — zero screen sticker, zero lighting seam.
 *
 * Selecting/hovering a work brings up the rig:
 *  - `.tv-screen` sits *underneath* `tv-alpha.webp` (bleeding slightly under the
 *    opaque recessed bezel so no gap can ever appear) and runs the CRT channel
 *    change: vertical-hold collapse → analogue snow → re-lock.
 *  - `.tv-frame-alpha` (`tv-alpha.webp`) sits *above* `.tv-screen`, masking the
 *    picture through the exact Photoshop alpha cutout of the curved glass tube.
 *  - `.tv-ambient` casts a subtle, color-adaptive glow from the active project
 *    onto the inner bezel bevels and the dark night asphalt in front of the set.
 */
export default function TvShowreel({ active, alphaSrc, frameWidth, frameHeight, label, autoplay = false }: Props) {
  const rigRef = useRef<HTMLDivElement>(null);
  const ambientRef = useRef<HTMLDivElement>(null);
  const pictureRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const staticRef = useRef<HTMLDivElement>(null);
  const rollRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  /** What is actually painted inside the tube right now — swapped mid-snow. */
  const [shown, setShown] = useState<TvWork | null>(active);
  const shownRef = useRef<TvWork | null>(active);
  const rigActiveRef = useRef<boolean>(Boolean(active));
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayFailed, setAutoplayFailed] = useState(false);
  /** Clips that failed to load fall back to the project still. */
  const [broken, setBroken] = useState<Record<string, true>>({});

  /** One 160 px tile of analogue snow, generated once and stepped by GSAP. */
  useEffect(() => {
    const tile = document.createElement("canvas");
    tile.width = 160;
    tile.height = 160;
    const ctx = tile.getContext("2d");
    if (!ctx) return;
    const image = ctx.createImageData(tile.width, tile.height);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = Math.random() < 0.88 ? 36 + Math.random() * 124 : 200 + Math.random() * 55;
      image.data[i] = value;
      image.data[i + 1] = value * 1.01;
      image.data[i + 2] = value * 0.99;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    if (staticRef.current) staticRef.current.style.backgroundImage = `url(${tile.toDataURL("image/png")})`;
  }, []);

  useEffect(() => {
    const nextId = active?.id ?? null;
    const currentId = shownRef.current?.id ?? null;
    if (nextId === currentId && Boolean(active) === rigActiveRef.current) return;

    const rig = rigRef.current;
    const ambient = ambientRef.current;
    const picture = pictureRef.current;
    const staticLayer = staticRef.current;
    const roll = rollRef.current;
    const line = lineRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
      setIsPlaying(false);
      setAutoplayFailed(false);
    }

    const commit = (work: TvWork | null) => {
      shownRef.current = work;
      setShown(work);
    };

    timeline.current?.kill();

    if (reduce || !rig || !ambient || !picture || !staticLayer || !roll || !line) {
      rigActiveRef.current = Boolean(active);
      commit(active);
      if (rig) gsap.set(rig, { opacity: active ? 1 : 0 });
      if (ambient) gsap.set(ambient, { opacity: active ? 1 : 0 });
      if (picture) gsap.set(picture, { opacity: active ? 1 : 0, scaleY: 1, filter: RESTING_FILTER });
      if (staticLayer && roll && line) gsap.set([staticLayer, roll, line], { opacity: 0 });
      return;
    }

    const wasActive = rigActiveRef.current && (Number(gsap.getProperty(rig, "opacity")) > 0.15 || Boolean(currentId));
    rigActiveRef.current = Boolean(active);

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
    timeline.current = tl;
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as Record<string, unknown>;
      w.__tvTl = tl;
      const rate = w.__tvRate as number | undefined;
      if (rate) tl.timeScale(rate);
    }

    // 1 — Returning to the untouched `tv.webp` (unhovering or scrolling past the last work).
    if (!active) {
      tl.to(picture, { scaleY: 0.03, transformOrigin: "50% 50%", duration: 0.1, ease: "power2.in" }, 0)
        .to(picture, { filter: "brightness(2.5) saturate(0) contrast(1.3)", duration: 0.09 }, 0)
        .to(picture, { opacity: 0, duration: 0.05, ease: "none" }, 0.07)
        .to(staticLayer, { opacity: 0.85, duration: 0.05, ease: "none" }, 0.02)
        .fromTo(
          staticLayer,
          { backgroundPosition: "0px 0px" },
          { backgroundPosition: "240px 120px", duration: 0.22, ease: "steps(5)" },
          0.02
        )
        .to(line, { opacity: 0.78, duration: 0.04, ease: "none" }, 0.04)
        .to(ambient, { opacity: 0, duration: 0.22, ease: "power2.out" }, 0)
        .to([staticLayer, line, roll], { opacity: 0, duration: 0.16, ease: "power1.out" }, 0.1)
        .to(rig, { opacity: 0, duration: 0.18, ease: "power2.inOut" }, 0.08)
        .call(() => commit(null));
      return;
    }

    // 2 — First hover from idle `tv.webp`: snow bursts inside the alpha-cutout
    //     glass, then locks onto the project picture while ambient light blooms.
    if (!wasActive) {
      gsap.set(rig, { opacity: 1 });
      gsap.set(picture, {
        opacity: 0,
        scaleY: 0.03,
        transformOrigin: "50% 50%",
        filter: "brightness(2.6) saturate(0) contrast(1.3)",
      });
      tl.to(staticLayer, { opacity: 1, duration: 0.06, ease: "none" }, 0)
        .fromTo(
          staticLayer,
          { backgroundPosition: "0px 0px" },
          { backgroundPosition: "420px 210px", duration: 0.36, ease: "steps(8)" },
          0
        )
        .fromTo(line, { opacity: 0, scaleX: 0.96 }, { opacity: 0.88, scaleX: 1, duration: 0.05, ease: "none" }, 0)
        .fromTo(roll, { opacity: 0, yPercent: -130 }, { opacity: 0.55, yPercent: 130, duration: 0.32, ease: "power1.in" }, 0)
        .call(() => commit(active), undefined, 0.09)
        .to(picture, { opacity: 1, duration: 0.08, ease: "none" }, 0.11)
        .to(picture, { scaleY: 1, duration: 0.25, ease: "power3.out" }, 0.11)
        .to(picture, { filter: RESTING_FILTER, duration: 0.28 }, 0.13)
        .to(ambient, { opacity: 1, duration: 0.36, ease: "power2.out" }, 0.1)
        .to(line, { opacity: 0, duration: 0.14 }, 0.14)
        .to(staticLayer, { opacity: 0, duration: 0.2, ease: "power1.out" }, 0.18)
        .to(roll, { opacity: 0, duration: 0.18 }, 0.18);
      return;
    }

    // 3 — Switching between two works: classic CRT channel change.
    gsap.set(rig, { opacity: 1 });
    tl.to(picture, { scaleY: 0.02, transformOrigin: "50% 50%", duration: 0.11, ease: "power2.in" }, 0)
      .to(picture, { filter: "brightness(3.2) saturate(0) contrast(1.4)", duration: 0.11 }, 0)
      .to(picture, { opacity: 0, duration: 0.04, ease: "none" }, 0.09)
      .to(ambient, { opacity: 0.42, duration: 0.12, ease: "power1.in" }, 0)
      .fromTo(line, { opacity: 0, scaleX: 0.98 }, { opacity: 0.9, scaleX: 1, duration: 0.03, ease: "none" }, 0.06)
      .to(line, { opacity: 0, duration: 0.14, ease: "power1.in" }, 0.2)
      .to(staticLayer, { opacity: 1, duration: 0.04, ease: "none" }, 0.1)
      .to(roll, { opacity: 0.6, duration: 0.05 }, 0.1)
      .fromTo(
        staticLayer,
        { backgroundPosition: "0px 0px" },
        { backgroundPosition: "480px 240px", duration: 0.42, ease: "steps(9)" },
        0.1
      )
      .fromTo(roll, { yPercent: -140 }, { yPercent: 140, duration: 0.36, ease: "power1.in" }, 0.1)
      .call(() => commit(active), undefined, 0.2)
      .to(picture, { scaleY: 1, duration: 0.24, ease: "power3.out" }, 0.26)
      .to(picture, { opacity: 1, duration: 0.1, ease: "none" }, 0.26)
      .to(picture, { filter: RESTING_FILTER, duration: 0.28 }, 0.28)
      .to(ambient, { opacity: 1, duration: 0.32, ease: "power2.out" }, 0.26)
      .to(staticLayer, { opacity: 0, duration: 0.16, ease: "power1.out" }, 0.4)
      .to(roll, { opacity: 0, duration: 0.16 }, 0.4);
  }, [active]);

  useEffect(
    () => () => {
      timeline.current?.kill();
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    },
    []
  );

  const handleScreenClick = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.src) return;

    if (video.paused) {
      void video
        .play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayFailed(false);
        })
        .catch(() => {
          setIsPlaying(false);
          setAutoplayFailed(true);
        });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => {
      setIsPlaying(true);
      setAutoplayFailed(false);
    };
    const onPause = () => setIsPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [shown?.videoSrc]);

  const isVideoWork = Boolean(shown?.videoSrc) && !(shown?.videoSrc && broken[shown.videoSrc]);
  const posterSrc = shown?.videoPoster ?? shown?.src;

  const activeId = active?.id ?? null;

  /*
   * Direct playback for the active video channel.
   *
   * Rows preview starts after the short channel-lock beat; theater waits for
   * its longer opening move. The shown id must match the active id so a video
   * from the previous channel never starts during the snow transition.
   *
   * Muted + playsInline makes this eligible for normal browser autoplay.
   * If a browser still rejects it, the existing screen click and a fallback
   * play icon remain available; no repeated retry loop is created.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideoWork) return;

    if (!activeId || shown?.id !== activeId) {
      video.pause();
      return;
    }

    let cancelled = false;

    const start = () => {
      if (cancelled) return;
      video.muted = true;
      // Cleared on the attempt itself rather than in the effect body: a
      // synchronous setState here would cascade an extra render per channel.
      setAutoplayFailed(false);

      void video
        .play()
        .then(() => {
          if (cancelled) return;
          setIsPlaying(true);
          setAutoplayFailed(false);
        })
        .catch(() => {
          if (cancelled) return;
          setIsPlaying(false);
          setAutoplayFailed(true);
        });
    };

    const delay = window.setTimeout(start, autoplay ? 380 : 120);

    return () => {
      cancelled = true;
      window.clearTimeout(delay);
    };
  }, [activeId, autoplay, isVideoWork, shown?.id]);

  return (
    <div
      ref={rigRef}
      className="tv-active-rig"
      data-active={active ? "true" : "false"}
      data-theater={autoplay ? "true" : undefined}
      aria-hidden={!active || undefined}
    >
      {/* Subtle ambient light cast by the active screen onto the bezel & night asphalt */}
      <div ref={ambientRef} className="tv-ambient" aria-hidden="true">
        {posterSrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="tv-ambient-halo"
              src={asset(posterSrc)}
              srcSet={srcSetFor(posterSrc)}
              sizes="28vw"
              alt=""
              decoding="async"
              draggable={false}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="tv-ambient-ground"
              src={asset(posterSrc)}
              srcSet={srcSetFor(posterSrc)}
              sizes="28vw"
              alt=""
              decoding="async"
              draggable={false}
            />
          </>
        ) : null}
        <div className="tv-ambient-bloom" />
      </div>

      {/* Screen aperture layered *underneath* `tv-alpha.webp` so the Photoshop
          alpha cutout masks the curved bezel edge with zero seam. */}
      <div className="tv-screen">
        <div ref={pictureRef} className="tv-picture">
          {isVideoWork ? (
            <video
              ref={videoRef}
              className="tv-cover tv-video"
              src={shown?.videoSrc ? asset(shown.videoSrc) : undefined}
              poster={posterSrc ? asset(posterSrc) : undefined}
              preload="auto"
              muted
              loop
              playsInline
              onClick={handleScreenClick}
              onError={() => shown?.videoSrc && setBroken((prev) => ({ ...prev, [shown.videoSrc as string]: true }))}
              aria-label={shown ? label(shown.alt) : ""}
              draggable={false}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              className="tv-cover"
              src={shown ? asset(shown.src) : undefined}
              srcSet={shown ? srcSetFor(shown.src) : undefined}
              sizes={shown?.src ? "(max-width: 767px) 80vw, 55vw" : undefined}
              alt={shown ? label(shown.alt) : ""}
              decoding="async"
              draggable={false}
            />
          )}
        </div>
        <div className="tv-crt-optics" aria-hidden="true" />
        {isVideoWork && autoplayFailed && !isPlaying ? (
          <div className="tv-play-btn" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        ) : null}
        <div ref={staticRef} className="tv-static" aria-hidden="true" />
        <div ref={lineRef} className="tv-sync-line" aria-hidden="true" />
        <div ref={rollRef} className="tv-roll" aria-hidden="true" />
      </div>

      <Img
        className="tv-frame-alpha"
        src={alphaSrc}
        alt=""
        sizes="(max-aspect-ratio: 3/2) 295vh, 185vw"
        hidden
        loading="lazy"
        draggable={false}
        width={frameWidth}
        height={frameHeight}
      />
    </div>
  );
}
