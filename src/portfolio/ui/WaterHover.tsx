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

import { useEffect } from "react";

/**
 * Pointer-driven ripple over content photographs.
 *
 * Interaction reference: the *idea* of a media hover that stretches locally with
 * pointer direction and speed rather than scaling the whole picture. No shader,
 * asset or markup from that reference is used — this is an independent
 * implementation of a decaying 2D wave with a directional wake.
 *
 * Ground rules, because this runs over a scroll-choreographed page:
 *
 * - **The `<img>` is never replaced or hidden.** A canvas is inserted *after*
 *   it for as long as the pointer is inside it; the original photo stays right
 *   underneath. If WebGL is unavailable, the image decode fails, the context
 *   is lost or the texture upload is refused, the page looks exactly as before.
 * - **One canvas, one context, one image at a time.** Nothing is allocated per
 *   picture, and there is no permanent canvas in the document. Once the pointer
 *   leaves (or the page scrolls, or the tab hides) the canvas is removed and the
 *   RAF stops — idle pages do no work here.
 * - **The overlay is slaved to the photograph's live box.** Position, size,
 *   margin, transform, origin, radius, clip, filter and blend mode are copied
 *   from the `<img>` every frame, so the ripple follows the GSAP hero parallax,
 *   gallery `xPercent`, coda drift and any object-position animation without
 *   its own timeline.
 * - **The texture is the picture already on screen.** It is painted from the
 *   `<img>` (`currentSrc`, i.e. whatever `srcSet` picked) through a 2D canvas
 *   with the same `object-fit` / `object-position` cover maths, then uploaded.
 *   No second request, no bypassing of `sizes`.
 * - **Fine pointers only, and not under reduced motion.** Touch scrolling is
 *   never intercepted and no hover state is left behind.
 */

const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision mediump float;

varying vec2 vUv;
uniform sampler2D uTexture;
uniform vec2 uPointer;
uniform vec2 uVelocity;
uniform float uTime;
uniform float uStrength;
uniform float uAspect;

void main() {
  /* Measure distance in the image's physical aspect, not a square UV space. */
  vec2 delta = vec2(
    (vUv.x - uPointer.x) * uAspect,
    vUv.y - uPointer.y
  );
  float distanceToPointer = length(delta);
  float influence = 1.0 - smoothstep(0.0, 0.86, distanceToPointer);
  vec2 direction = delta / max(distanceToPointer, 0.0001);
  vec2 perpendicular = vec2(-direction.y, direction.x);

  float wave = sin(distanceToPointer * 36.0 - uTime * 5.4);
  vec2 physicalOffset = direction * wave * influence * uStrength * 0.02;
  physicalOffset += perpendicular
    * cos(distanceToPointer * 24.0 - uTime * 3.4)
    * influence
    * uStrength
    * 0.005;

  /* The wake follows the recent path behind the pointer, not ahead of it. */
  vec2 physicalVelocity = vec2(uVelocity.x * uAspect, uVelocity.y);
  float speed = length(physicalVelocity);
  vec2 travel = physicalVelocity / max(speed, 0.0001);
  float along = dot(delta, travel);
  float across = abs(delta.x * travel.y - delta.y * travel.x);
  float behind = max(0.0, -along);
  float wakeGate = smoothstep(0.05, 0.45, speed);
  float wakeShape =
    smoothstep(0.01, 0.12, behind)
    * (1.0 - smoothstep(0.2, 0.96, behind))
    * (1.0 - smoothstep(0.02, 0.3, across));
  float wakeInfluence = wakeShape * wakeGate * uStrength;
  float wakePhase = sin(behind * 32.0 - uTime * 4.0);
  physicalOffset += travel * wakePhase * wakeInfluence * 0.012;
  physicalOffset += vec2(-travel.y, travel.x)
    * cos(behind * 24.0 - uTime * 3.4)
    * wakeInfluence
    * 0.004;

  /* Convert the aspect-correct offset back to UVs, then mirror at the edges. */
  vec2 offset = vec2(physicalOffset.x / max(uAspect, 0.0001), physicalOffset.y);
  vec2 wrapped = mod(vUv + offset, 2.0);
  vec2 uv = 1.0 - abs(wrapped - 1.0);
  gl_FragColor = texture2D(uTexture, uv);
}
`;

type Session = {
  img: HTMLImageElement;
  x: number;
  y: number;
  lastMove: number;
  vx: number;
  vy: number;
  strength: number;
  targetStrength: number;
  dragging: boolean;
  fade: number;
  leaving: boolean;
  textureKey: string;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create water shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Water shader failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create water program");

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Water program failed";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

/** `left` / `30%` / `center` → 0…1 along one axis of `object-position`. */
function positionPart(token: string | undefined) {
  if (!token) return 0.5;
  if (token.endsWith("%")) {
    const value = Number.parseFloat(token);
    return Number.isFinite(value) ? clamp(value / 100, 0, 1) : 0.5;
  }
  if (token === "left" || token === "top") return 0;
  if (token === "right" || token === "bottom") return 1;
  return 0.5;
}

function objectPosition(value: string): [number, number] {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return [0.5, 0.5];
  if (parts.length === 1) {
    // A lone vertical keyword centres the horizontal axis, and vice versa.
    const only = parts[0];
    if (only === "top" || only === "bottom") return [0.5, positionPart(only)];
    return [positionPart(only), 0.5];
  }
  return [positionPart(parts[0]), positionPart(parts[1])];
}

/**
 * Nearest ancestor that establishes the containing block for an absolutely
 * positioned child. Only consulted for in-flow images, where copying
 * `left`/`top` from the computed style is meaningless.
 */
function containingBlock(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (
      style.position !== "static" ||
      style.transform !== "none" ||
      style.filter !== "none" ||
      style.perspective !== "none" ||
      /paint|layout|strict|content/.test(style.contain)
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

class WaterEngine {
  private canvas?: HTMLCanvasElement;
  private source?: HTMLCanvasElement;
  private gl?: WebGLRenderingContext;
  private program?: WebGLProgram;
  private buffer?: WebGLBuffer;
  private texture?: WebGLTexture;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private failed = false;

  private init() {
    if (this.failed) return false;
    if (this.gl) return true;

    const canvas = document.createElement("canvas");
    canvas.dataset.waterCanvas = "";
    canvas.setAttribute("aria-hidden", "true");

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    });

    if (!gl) {
      this.failed = true;
      return false;
    }

    try {
      const program = createProgram(gl);
      const buffer = gl.createBuffer();
      const texture = gl.createTexture();
      if (!buffer || !texture) throw new Error("Unable to allocate water resources");

      this.canvas = canvas;
      this.gl = gl;
      this.program = program;
      this.buffer = buffer;
      this.texture = texture;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );

      const position = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // No mipmaps (`texImage2D` with a canvas has no full chain) — clamped,
      // linearly filtered, which is all a cover-sized quad needs.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      for (const name of [
        "uTexture",
        "uPointer",
        "uVelocity",
        "uTime",
        "uStrength",
        "uAspect",
      ]) {
        this.uniforms[name] = gl.getUniformLocation(program, name);
      }
      gl.uniform1i(this.uniforms.uTexture, 0);
      return true;
    } catch {
      this.failed = true;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return false;
    }
  }

  attach(img: HTMLImageElement) {
    if (!this.init() || !this.canvas) return false;
    this.canvas.remove();
    // Sibling, not wrapper: the `<img>` stays the boxed element and every
    // direct-child selector in the stylesheet keeps matching.
    img.after(this.canvas);
    return true;
  }

  detach() {
    this.canvas?.remove();
  }

  private upload(
    img: HTMLImageElement,
    css: CSSStyleDeclaration,
    width: number,
    height: number,
  ) {
    const gl = this.gl;
    if (!gl) return;

    const source = this.source ?? document.createElement("canvas");
    this.source = source;
    if (source.width !== width) source.width = width;
    if (source.height !== height) source.height = height;

    const context = source.getContext("2d");
    if (!context) throw new Error("Unable to create texture canvas");

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const fit = css.objectFit || "fill";
    const [positionX, positionY] = objectPosition(css.objectPosition);

    let drawWidth = width;
    let drawHeight = height;

    if (fit !== "fill") {
      const scale =
        fit === "contain"
          ? Math.min(width / naturalWidth, height / naturalHeight)
          : Math.max(width / naturalWidth, height / naturalHeight);
      drawWidth = naturalWidth * scale;
      drawHeight = naturalHeight * scale;
    }

    const x = fit === "fill" ? 0 : (width - drawWidth) * positionX;
    const y = fit === "fill" ? 0 : (height - drawHeight) * positionY;

    context.clearRect(0, 0, width, height);
    // The same cover/contain crop the browser is showing, at texture scale.
    context.drawImage(img, x, y, drawWidth, drawHeight);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture ?? null);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source,
    );
  }

  render(session: Session, now: number) {
    const { img } = session;
    const gl = this.gl;
    const canvas = this.canvas;

    if (
      !gl ||
      !canvas ||
      !img.isConnected ||
      !img.complete ||
      !img.naturalWidth ||
      !img.naturalHeight
    ) {
      return false;
    }
    if (gl.isContextLost()) {
      this.failed = true;
      return false;
    }

    const css = getComputedStyle(img);
    const cssWidth = img.clientWidth;
    const cssHeight = img.clientHeight;
    if (cssWidth < 2 || cssHeight < 2) return false;

    const fit = css.objectFit || "fill";
    if (!["cover", "contain", "fill"].includes(fit)) return false;

    const style = canvas.style;
    style.display = "block";
    style.pointerEvents = "none";
    style.userSelect = "none";
    style.willChange = "opacity";

    if (css.position === "static") {
      // In-flow picture (nothing like that ships today, but a future content
      // image should not silently break): pin the overlay to the box the `<img>`
      // actually occupies, measured against the canvas's own containing block.
      const block = containingBlock(canvas) ?? document.documentElement;
      const root = block === document.documentElement;
      const blockRect = block.getBoundingClientRect();
      const rect = img.getBoundingClientRect();
      // Absolutely positioned children of the root resolve against the initial
      // containing block, i.e. viewport coordinates plus the document scroll.
      const scrollLeft = root ? window.scrollX : block.scrollLeft;
      const scrollTop = root ? window.scrollY : block.scrollTop;
      style.position = "absolute";
      style.left = `${rect.left - blockRect.left - block.clientLeft + scrollLeft}px`;
      style.top = `${rect.top - blockRect.top - block.clientTop + scrollTop}px`;
      style.right = "auto";
      style.bottom = "auto";
      style.margin = "0";
      style.transform = "none";
      style.transformOrigin = "50% 50%";
      style.boxSizing = "border-box";
      style.width = `${rect.width}px`;
      style.height = `${rect.height}px`;
    } else {
      style.position = css.position;
      style.left = css.left;
      style.top = css.top;
      style.right = css.right;
      style.bottom = css.bottom;
      style.margin = css.margin;
      style.boxSizing = css.boxSizing;
      style.width = css.width;
      style.height = css.height;
      style.minWidth = css.minWidth;
      style.minHeight = css.minHeight;
      style.maxWidth = css.maxWidth;
      style.maxHeight = css.maxHeight;
      style.transform = css.transform;
      style.transformOrigin = css.transformOrigin;
    }

    style.borderRadius = css.borderRadius;
    style.clipPath = css.clipPath;
    style.filter = css.filter;
    style.mixBlendMode = css.mixBlendMode;
    style.zIndex = css.zIndex;
    // Cross-faded on entry/exit while preserving the picture's own opacity.
    style.opacity = String(
      clamp(session.fade * (Number.parseFloat(css.opacity) || 1), 0, 1),
    );

    // DPR capped at 1.5, longest side capped at 2048, then quantised to a
    // 16px grid: the story portrait's width is tweened (76% → 100%) and a
    // texture upload on every frame of that tween would be pure waste. The
    // canvas CSS box still follows the picture to the pixel; only the backing
    // store steps, and a half-step stretch is invisible under a ripple.
    const ratio = Math.min(
      window.devicePixelRatio || 1,
      1.5,
      2048 / cssWidth,
      2048 / cssHeight,
    );
    const step = 16;
    const width = Math.min(
      2048,
      Math.max(2, Math.round((cssWidth * ratio) / step) * step),
    );
    const height = Math.min(
      2048,
      Math.max(2, Math.round((cssHeight * ratio) / step) * step),
    );

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      session.textureKey = "";
    }

    const textureKey = [
      img.currentSrc,
      img.naturalWidth,
      img.naturalHeight,
      width,
      height,
      fit,
      css.objectPosition,
    ].join("|");

    if (textureKey !== session.textureKey) {
      this.upload(img, css, width, height);
      session.textureKey = textureKey;
    }

    const amplitude =
      img.dataset.water === "subtle"
        ? 0.7
        : img.dataset.water === "strong"
          ? 1.15
          : 1;

    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program!);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture ?? null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // `vUv` is bottom-up, the pointer is measured top-down.
    gl.uniform2f(this.uniforms.uPointer, session.x, 1 - session.y);
    gl.uniform2f(this.uniforms.uVelocity, session.vx, -session.vy);
    gl.uniform1f(this.uniforms.uTime, now / 1000);
    gl.uniform1f(this.uniforms.uStrength, session.strength * amplitude);
    gl.uniform1f(this.uniforms.uAspect, cssWidth / cssHeight);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }

  dispose() {
    this.detach();
    const gl = this.gl;
    if (gl) {
      if (this.buffer) gl.deleteBuffer(this.buffer);
      if (this.texture) gl.deleteTexture(this.texture);
      if (this.program) gl.deleteProgram(this.program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.failed = true;
  }
}

export default function WaterHover() {
  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const engine = new WaterEngine();

    let active: Session | null = null;
    let raf = 0;
    let previous = 0;

    const removeActive = () => {
      engine.detach();
      active = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    /** Start (or continue) the fade-out; the RAF removes the canvas at the end. */
    const release = () => {
      if (active) active.leaving = true;
    };

    const tick = (now: number) => {
      raf = 0;
      const session = active;
      if (!session) return;

      const delta = Math.min(0.05, Math.max(0.001, (now - previous) / 1000));
      previous = now;

      if (session.leaving) session.targetStrength = 0;
      else if (now - session.lastMove > 90) {
        // Holding still: the ripple settles fully instead of looping at any
        // nonzero resting strength.
        session.targetStrength = 0;
      }

      const fadeEase =
        1 - Math.exp(-delta * (session.leaving ? 6 : 10));
      const strengthEase = 1 - Math.exp(-delta * 8);
      const velocityDecay = Math.exp(-delta * 3.4);

      session.fade += ((session.leaving ? 0 : 1) - session.fade) * fadeEase;
      session.strength += (session.targetStrength - session.strength) * strengthEase;
      session.vx *= velocityDecay;
      session.vy *= velocityDecay;

      let rendered = false;
      try {
        rendered = engine.render(session, now);
      } catch {
        rendered = false;
      }

      if (!rendered) {
        removeActive();
        return;
      }

      if (session.leaving && session.fade < 0.01 && session.strength < 0.01) {
        removeActive();
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    const eventImage = (event: Event) => {
      const target = event.target;
      return target instanceof HTMLImageElement && target.matches("img[data-water]")
        ? target
        : null;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!finePointer.matches || reducedMotion.matches || document.hidden) {
        release();
        return;
      }

      const img = eventImage(event);

      if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) {
        release();
        return;
      }

      // Only same-origin pixels can be read into a texture; anything remote
      // would taint the 2D canvas and fail the upload.
      const source = new URL(img.currentSrc || img.src, window.location.href);
      if (source.origin !== window.location.origin) {
        release();
        return;
      }

      const rect = img.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        release();
        return;
      }

      const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      const now = performance.now();

      if (!active || active.img !== img) {
        removeActive();
        if (!engine.attach(img)) return;

        active = {
          img,
          x,
          y,
          lastMove: now,
          vx: 0,
          vy: 0,
          strength: 0,
          targetStrength: 0.14,
          dragging: false,
          fade: 0,
          leaving: false,
          textureKey: "",
        };
        previous = now;
        raf = requestAnimationFrame(tick);
        return;
      }

      const session = active;
      const seconds = Math.max(0.008, (now - session.lastMove) / 1000);
      const dx = x - session.x;
      const dy = y - session.y;
      const speed = Math.hypot(dx, dy) / seconds;

      session.vx = clamp(dx / seconds, -2.4, 2.4);
      session.vy = clamp(dy / seconds, -2.4, 2.4);
      session.targetStrength = Math.max(
        session.dragging ? 0.34 : 0.12,
        Math.min(1, speed / 2.2),
      );
      session.x = x;
      session.y = y;
      session.lastMove = now;
      session.leaving = false;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!finePointer.matches || reducedMotion.matches || event.button !== 0) return;
      const img = eventImage(event);
      if (!img) return;

      onPointerMove(event);
      if (!active || active.img !== img || active.leaving) return;
      active.dragging = true;
      active.lastMove = performance.now();
      active.targetStrength = Math.max(active.targetStrength, 0.34);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!active) return;
      if (eventImage(event) !== active.img) {
        active.dragging = false;
        release();
        return;
      }
      active.dragging = false;
      active.targetStrength = Math.min(active.targetStrength, 0.12);
      active.lastMove = performance.now();
    };

    const onPointerOut = (event: PointerEvent) => {
      // The img can be left for another element without leaving the document.
      if ((active && event.target === active.img) || !event.relatedTarget) release();
    };

    const onPointerCancel = () => {
      if (active) active.dragging = false;
      release();
    };

    const onPreferenceChange = () => {
      if (!finePointer.matches || reducedMotion.matches) removeActive();
    };

    const onVisibilityChange = () => {
      if (document.hidden) removeActive();
    };

    window.addEventListener("pointermove", onPointerMove, {
      capture: true,
      passive: true,
    });
    window.addEventListener("pointerdown", onPointerDown, {
      capture: true,
      passive: true,
    });
    window.addEventListener("pointerup", onPointerUp, {
      capture: true,
      passive: true,
    });
    document.addEventListener("pointerout", onPointerOut, {
      capture: true,
      passive: true,
    });
    document.addEventListener("pointercancel", onPointerCancel, { passive: true });
    // The photograph's own box is scrolling away from the pointer: let it go
    // instead of dragging a stale texture across the page.
    window.addEventListener("scroll", release, { capture: true, passive: true });
    window.addEventListener("blur", removeActive);
    document.addEventListener("visibilitychange", onVisibilityChange);
    finePointer.addEventListener("change", onPreferenceChange);
    reducedMotion.addEventListener("change", onPreferenceChange);

    return () => {
      removeActive();
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("scroll", release, true);
      window.removeEventListener("blur", removeActive);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      finePointer.removeEventListener("change", onPreferenceChange);
      reducedMotion.removeEventListener("change", onPreferenceChange);
      engine.dispose();
    };
  }, []);

  return null;
}
