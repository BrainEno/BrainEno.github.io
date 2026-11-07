/**
 * Copyright © 2026 BrainEno. 保留所有权利。
 *
 * 本文件及其包含的代码、设计和逻辑均为 BrainEno 的原创作品。
 * 未经作者明确书面授权，禁止复制、修改、分发或用于其他项目。
 *
 * 授权申请：nodeman24@outlook.com
 * 详见：LICENSE, TERMS.md
 */

/**
 * The site's north-east arrow, drawn instead of typed.
 *
 * It used to be the character `↗` (U+2197). Three things are wrong with that on
 * a phone:
 *
 * - **No font in the stack ships it.** `U+2197` is not in Inter's latin subset
 *   (the range stops at U+2191/U+2193) and Aeonik is `local()`-only, so the
 *   glyph has always come from whatever the OS falls back to.
 * - **It is emoji-capable.** iOS answers with Apple Color Emoji when the text
 *   fonts have no glyph — the blue-tile arrow instead of a hairline one.
 * - **The fallback lands late.** Text swaps in `font-display: swap`, so on a
 *   slow connection the arrow visibly changes shape while the reader is
 *   looking at it, and off a good connection it never settles at all.
 *
 * An inline path has no font, no network request and no per-OS variation: the
 * same arrow, from the first paint, everywhere.
 *
 * Geometry is a 45° shaft with a squared head, drawn to the optical size of the
 * glyph it replaces. Sites size it in `em` (see `portfolio.css` /
 * `work-detail.css`), so it keeps tracking the type it sits next to, and it
 * inherits `currentColor`, so hover/accent transitions still apply.
 */
export function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="butt"
      strokeLinejoin="miter"
    >
      {/* Shaft, then the two head strokes: the classic ↗ silhouette. */}
      <path d="M1 15 15 1M15 1H7.6M15 1V8.4" />
    </svg>
  );
}
