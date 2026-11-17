/**
 * Copyright © 2026 BrainEno. 保留所有权利。
 *
 * Motion preference policy shared by the scroll choreography, CRT, and theater.
 * A reduced-motion preference is a separate presentation mode, not a request
 * to play the same sequence faster. User-initiated controls remain available;
 * only automatic, scroll-driven, and decorative motion is disabled.
 */
export type MotionPolicy = Readonly<{
  /** Smooth scrolling adds easing after the user has stopped scrolling. */
  smoothScroll: number;
  /** Hero, story, television, and contact scroll-linked transforms. */
  scrollTransforms: boolean;
  /** ScrollTrigger pinning, including the gallery and television stage. */
  sectionPins: boolean;
  /** CRT snow, sync-line, and channel-lock transition timelines. */
  channelEffects: boolean;
  /** Automatically start a video when its row becomes the active channel. */
  autoplayPreview: boolean;
  /** Camera push / sheet reveal for an explicitly opened theater. */
  theaterCamera: boolean;
  /** Time-based marquee and staggered entrance choreography. */
  ambientLoops: boolean;
}>;

const FULL_MOTION: MotionPolicy = Object.freeze({
  smoothScroll: 1.1,
  scrollTransforms: true,
  sectionPins: true,
  channelEffects: true,
  autoplayPreview: true,
  theaterCamera: true,
  ambientLoops: true,
});

const REDUCED_MOTION: MotionPolicy = Object.freeze({
  smoothScroll: 0,
  scrollTransforms: false,
  sectionPins: false,
  channelEffects: false,
  autoplayPreview: false,
  theaterCamera: false,
  ambientLoops: false,
});

/**
 * Return the complete behavior set for one matchMedia evaluation.
 *
 * Kept pure so the two modes can be tested without a browser or a GSAP ticker.
 * `gsap.matchMedia` owns re-evaluation when the operating-system preference
 * changes; each resulting context consumes one immutable policy.
 */
export function motionPolicy(reduced: boolean): MotionPolicy {
  return reduced ? REDUCED_MOTION : FULL_MOTION;
}
