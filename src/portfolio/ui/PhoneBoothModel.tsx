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

import { useEffect, useRef } from "react";
import type { BoothHandle } from "../three/booth";
import { shouldPauseBooth } from "../three/booth-visibility";
import { asset } from "../seo/asset";
import { srcSetFor } from "./Img";

type Props = {
  /** Optimised GLB of the uploaded telephone model. */
  src: string;
  /** Flat cutout kept as the pre-WebGL state and the no-WebGL fallback. */
  fallback: string;
  /** Idle self-rotation, radians per second (slow: ~37 s per turn). */
  spin?: number;
  /** Replaces the phone number lettering modelled onto the booth panels. */
  plateText?: string;
};

/**
 * Mounts the WebGL booth only when the contact section is getting close, and
 * keeps the photographic cutout underneath so the entrance animation never
 * plays into an empty box (and so the page still reads correctly without
 * WebGL, on reduced motion, or while the 2 MB model streams in).
 */
export function PhoneBoothModel({ src, fallback, spin = 0.16, plateText }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stillRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let handle: BoothHandle | null = null;
    let loading = false;
    let pauseObserver: IntersectionObserver | null = null;
    // Start pessimistically: the preload observer can run well before the
    // booth enters the viewport, and its visibility callback may arrive after
    // the model finishes loading.
    let viewportVisible = false;
    let documentVisible = !document.hidden;
    const syncPaused = () => {
      const paused = shouldPauseBooth(viewportVisible, documentVisible);
      host.dataset.paused = String(paused);
      handle?.setPaused(paused);
    };
    const onVisibilityChange = () => {
      documentVisible = !document.hidden;
      syncPaused();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = motionQuery.matches;
    const onMotionChange = () => {
      reduceMotion = motionQuery.matches;
      handle?.setReducedMotion(reduceMotion);
    };
    motionQuery.addEventListener("change", onMotionChange);

    const mount = async () => {
      if (loading || disposed || handle) return;
      loading = true;
      try {
        const { mountBooth } = await import("../three/booth");
        if (disposed) return;
        const mounted = await mountBooth(host, {
          url: src,
          spin,
          reduceMotion,
          initiallyPaused: shouldPauseBooth(viewportVisible, documentVisible),
          isCancelled: () => disposed,
          plateText,
        });
        if (disposed) {
          mounted.dispose();
          return;
        }
        handle = mounted;
        // Motion and visibility may have changed during the async import/model fetch.
        handle.setReducedMotion(reduceMotion);
        syncPaused();
        // Written straight to the DOM instead of through state: the canvas is
        // already painted at this point and the cutout underneath must be
        // hidden in the same frame (a React re-render would let one frame of
        // the flat image show through the model).
        // The flat cutout is switched off inline as well as by the `[data-ready]`
        // rule: it carries a 0.6 s opacity transition for the hand-over, and a
        // transition that never gets to run (throttled tab, reduced-motion
        // emulation, a stalled compositor) would leave a second, paler booth
        // ghosted behind the real one.
        const still = stillRef.current;
        if (still) {
          still.style.transition = "none";
          still.style.opacity = "0";
        }
        host.dataset.ready = "true";
      } catch (error) {
        // Keep visibility tracking for the animated photographic fallback.
        motionQuery.removeEventListener("change", onMotionChange);
        if (disposed) return;
        // A failed decode / unsupported WebGL must not break the section.
        console.warn("[booth] falling back to the cutout image", error);
        host.dataset.fallback = "true";
      }
    };

    // Fetch the model before the section scrolls in so the entrance is never
    // waiting on the network.
    const preload = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        preload.disconnect();
        void mount();
      },
      { rootMargin: "150% 0px 150% 0px" }
    );
    preload.observe(host);

    // Park the render loop whenever the booth is off screen.
    pauseObserver = new IntersectionObserver(
      (entries) => {
        viewportVisible = entries.some((entry) => entry.isIntersecting);
        syncPaused();
      },
      { rootMargin: "20% 0px 20% 0px" }
    );
    pauseObserver.observe(host);

    return () => {
      disposed = true;
      preload.disconnect();
      pauseObserver?.disconnect();
      pauseObserver = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
      handle?.dispose();
      handle = null;
    };
  }, [src, spin, plateText]);

  return (
    <div ref={hostRef} className="contact-booth-canvas" data-paused="true" aria-hidden="true">
      {/* Kept a raw `<img>` rather than `Img`: the hand-over hides this node by
          writing `style.opacity` straight to the DOM, so it needs the ref. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={stillRef}
        className="contact-booth-still"
        src={asset(fallback)}
        srcSet={srcSetFor(fallback)}
        sizes="(max-width: 1023px) 34vh, 44vh"
        alt=""
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
