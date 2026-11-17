/**
 * Copyright © 2026 BrainEno. 保留所有权利。
 *
 * A tiny generation gate for asynchronous animation callbacks. React effects,
 * GSAP timelines, and HTMLMediaElement.play() promises can all finish after a
 * newer channel was requested. The latest token is the sole authority allowed
 * to commit a visual or playback state.
 */
export type TransitionToken = number;

export type TransitionEpoch = Readonly<{
  /** Begin a new request and invalidate every callback from older requests. */
  next: () => TransitionToken;
  /** Invalidate all pending callbacks, normally on unmount. */
  invalidate: () => TransitionToken;
  /** True only while the token still owns the current request. */
  isCurrent: (token: TransitionToken) => boolean;
  /** The monotonically increasing generation, useful for diagnostics/tests. */
  current: () => number;
}>;

export function createTransitionEpoch(): TransitionEpoch {
  let generation = 0;
  return Object.freeze({
    next: () => {
      generation += 1;
      return generation;
    },
    invalidate: () => {
      generation += 1;
      return generation;
    },
    isCurrent: (token: TransitionToken) => token === generation,
    current: () => generation,
  });
}

/** Distinguish a real retune from a rerender carrying the same work. */
export function channelKey(workId: string | null, active: boolean): string {
  return `${active ? "on" : "off"}:${workId ?? "<none>"}`;
}

/**
 * Testable rectangle predicate used for delegated CRT glass hit-testing.
 * Right and bottom edges are exclusive, matching normal DOM hit testing: a
 * point exactly on the bezel belongs to the bezel rather than the video.
 */
export type Bounds = Pick<DOMRect, "left" | "top" | "right" | "bottom">;

export function containsPoint(bounds: Bounds, x: number, y: number): boolean {
  return x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom;
}

/** Playback text is localized at the component edge, kept here to avoid
 *  divergent labels between the keyboard button and its live announcement. */
export type VideoPlaybackState = "unavailable" | "playing" | "paused" | "blocked";

/** A user-initiated row action that may wait for the CRT channel lock. */
export type VideoPlaybackRequest = Readonly<{
  workId: string;
  action: "play" | "pause";
  sequence: number;
}>;

/** Keep a queued row action until both channel intent and painted media agree. */
export function isPlaybackRequestReady(
  request: VideoPlaybackRequest,
  activeWorkId: string | null,
  shownWorkId: string | null,
  videoReady: boolean
): boolean {
  return videoReady && request.workId === activeWorkId && request.workId === shownWorkId;
}

/** A play promise belongs only to the latest channel *and* playback action. */
export function ownsPlaybackResult(
  channelEpoch: TransitionEpoch,
  channelToken: TransitionToken,
  playbackEpoch: TransitionEpoch,
  playbackToken: TransitionToken
): boolean {
  return channelEpoch.isCurrent(channelToken) && playbackEpoch.isCurrent(playbackToken);
}

export function videoControlCopy(
  language: "zh" | "en",
  state: VideoPlaybackState,
  title: string
): { label: string; announcement: string } {
  if (language === "zh") {
    switch (state) {
      case "playing":
        return { label: `暂停${title}视频`, announcement: `${title}，正在播放` };
      case "paused":
        return { label: `播放${title}视频`, announcement: `${title}，已暂停` };
      case "blocked":
        return { label: `播放${title}视频`, announcement: `${title} 无法自动播放，请按 Enter 或空格键播放` };
      default:
        return { label: `${title} 视频暂不可用`, announcement: `${title} 的视频无法播放，已显示静态预览` };
    }
  }
  switch (state) {
    case "playing":
      return { label: `Pause ${title} video`, announcement: `${title}, playing` };
    case "paused":
      return { label: `Play ${title} video`, announcement: `${title}, paused` };
    case "blocked":
      return { label: `Play ${title} video`, announcement: `${title} could not autoplay. Press Enter or Space to play.` };
    default:
      return { label: `${title} video unavailable`, announcement: `${title} is unavailable; showing the still preview.` };
  }
}
