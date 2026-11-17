/**
 * Completion memory for one-shot entrance reveals. ScrollTrigger contexts may
 * be rebuilt after language, viewport, or motion-preference changes; this weak
 * ledger lets the replacement context restore a completed visual state rather
 * than replaying the entrance animation.
 */
export type RevealMemory = Readonly<{
  hasCompleted: (target: object) => boolean;
  complete: (target: object) => void;
  reset: (target: object) => void;
}>;

export function createRevealMemory(): RevealMemory {
  const completed = new WeakSet<object>();
  return Object.freeze({
    hasCompleted: (target: object) => completed.has(target),
    complete: (target: object) => completed.add(target),
    reset: (target: object) => completed.delete(target),
  });
}
