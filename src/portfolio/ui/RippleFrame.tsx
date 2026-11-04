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

import { useEffect, useId, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion, registerGsap } from "../scroll/choreography";
import { cx } from "./cx";

type RippleFrameProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Water on a frame.
 *
 * The picture behaves like a liquid surface under the pointer: a turbulence
 * field displaces it, and both the field's amplitude and its frequency follow
 * the pointer's speed, so a slow pass is a shiver and a fast one is a wave. The
 * image itself lags behind the cursor inside the frame (the "drag"), which is
 * what makes the surface feel like it has weight rather than being a filter
 * toggle. A tap on touch is a single drop: one ripple out and back.
 *
 * SVG rather than WebGL, deliberately — no second renderer and no dependency.
 * The filter is inert (`scale` 0) until a pointer arrives, so a page full of
 * frames costs nothing when nobody is over them, and `prefers-reduced-motion`
 * skips the whole thing: the frame is simply a photograph.
 *
 * Geometry lives in `portfolio.css` (`.ripple`, `.ripple-water`,
 * `.ripple-media`); this component only wires the filter and the pointer.
 */
export function RippleFrame({ children, className }: RippleFrameProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const displacementRef = useRef<SVGFEDisplacementMapElement>(null);
  const turbulenceRef = useRef<SVGFETurbulenceElement>(null);
  // `useId` keeps the filter id stable between the server render and hydration;
  // the colons React uses are stripped because `url(#…)` cannot carry them.
  const filterId = `pf-ripple-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const host = hostRef.current;
    const displacement = displacementRef.current;
    const turbulence = turbulenceRef.current;
    if (!host || !displacement || !turbulence) return;
    if (prefersReducedMotion()) return;
    registerGsap();

    const media = host.querySelector<HTMLElement>(".ripple-media");
    // One mutable state object is the whole model of the surface: amplitude of
    // the displacement (px) and the noise frequency. `write` is what turns it
    // into SVG attributes; everything else eases this object.
    const state = { scale: 0, frequency: 0.011 };
    const write = () => {
      displacement.setAttribute("scale", state.scale.toFixed(2));
      turbulence.setAttribute("baseFrequency", `${state.frequency.toFixed(4)} ${(state.frequency * 1.7).toFixed(4)}`);
    };
    write();

    const scaleTo = gsap.quickTo(state, "scale", { duration: 0.55, ease: "power2.out", onUpdate: write });
    const frequencyTo = gsap.quickTo(state, "frequency", { duration: 0.9, ease: "power2.out", onUpdate: write });
    const xTo = media ? gsap.quickTo(media, "xPercent", { duration: 0.9, ease: "power3.out" }) : null;
    const yTo = media ? gsap.quickTo(media, "yPercent", { duration: 0.9, ease: "power3.out" }) : null;

    // Pointer speed is measured between two moves, so a still pointer is calm
    // and a flick throws a wave; `last` is reset on leave to avoid a jump when
    // the pointer comes back somewhere else on the frame.
    let last = { x: 0, y: 0, time: 0 };

    const set = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = gsap.utils.clamp(-0.5, 0.5, (event.clientX - rect.left) / rect.width - 0.5);
      const ny = gsap.utils.clamp(-0.5, 0.5, (event.clientY - rect.top) / rect.height - 0.5);
      const time = event.timeStamp;
      const elapsed = last.time ? Math.max(8, time - last.time) : 16;
      const speed = last.time
        ? Math.min(1, Math.hypot(event.clientX - last.x, event.clientY - last.y) / elapsed / 1.6)
        : 0.35;
      last = { x: event.clientX, y: event.clientY, time };
      scaleTo(14 + speed * 54);
      frequencyTo(0.009 + speed * 0.019);
      xTo?.(nx * 4);
      yTo?.(ny * 4);
    };

    const calm = () => {
      last = { x: 0, y: 0, time: 0 };
      scaleTo(0);
      frequencyTo(0.011);
      xTo?.(0);
      yTo?.(0);
    };

    const drop = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      gsap
        .timeline()
        .to(state, { scale: 62, duration: 0.16, ease: "power2.out", onUpdate: write })
        .to(state, { scale: 0, duration: 1.15, ease: "power2.inOut", onUpdate: write });
      frequencyTo(0.02);
      if (media) gsap.fromTo(media, { scale: 1.04 }, { scale: 1, duration: 0.9, ease: "power3.out" });
    };

    host.addEventListener("pointerenter", set);
    host.addEventListener("pointermove", set);
    host.addEventListener("pointerleave", calm);
    host.addEventListener("pointerdown", drop);
    return () => {
      host.removeEventListener("pointerenter", set);
      host.removeEventListener("pointermove", set);
      host.removeEventListener("pointerleave", calm);
      host.removeEventListener("pointerdown", drop);
    };
  }, []);

  return (
    <span ref={hostRef} className={cx("ripple", className)}>
      {/* Never `display: none` — Safari drops filters whose definition is
          inside a hidden subtree. Zero-sized and inert instead. */}
      <svg className="ripple-defs" aria-hidden="true" focusable="false">
        <filter
          id={filterId}
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            ref={turbulenceRef}
            type="fractalNoise"
            baseFrequency="0.011 0.0187"
            numOctaves="2"
            seed="7"
            result="water"
          />
          <feDisplacementMap
            ref={displacementRef}
            in="SourceGraphic"
            in2="water"
            scale="0"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
      <span className="ripple-water" style={{ filter: `url(#${filterId})` }}>
        <span className="ripple-media">{children}</span>
      </span>
    </span>
  );
}
