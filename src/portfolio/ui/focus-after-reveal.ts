/** Wait for the visibility/layout commit, without scrolling the pinned stage
 * or stealing focus from a reader who already moved to another control. */
export function focusAfterReveal(target: HTMLElement | null, leaving: Element | null) {
  const frame = requestAnimationFrame(() => {
    if (target?.isConnected && (document.activeElement === document.body || document.activeElement === leaving)) {
      target.focus({ preventScroll: true });
    }
  });
  return () => cancelAnimationFrame(frame);
}
