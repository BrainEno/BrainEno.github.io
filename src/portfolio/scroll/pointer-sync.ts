/**
 * Coalesce scroll-driven pointer re-hit-tests. A stationary pointer can move
 * over a different project as the document scrolls, but checking
 * `elementFromPoint()` on every ScrollTrigger tick is unnecessary. This helper
 * keeps the latest requested state and runs at most once per interval, with an
 * immediate leading run and one trailing run for a burst.
 */
export type TimerHost = {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

export type RateLimitedTask = {
  /** Run immediately when eligible, otherwise schedule one trailing run. */
  request: () => void;
  /** Run a pending request now, even if the normal interval has not elapsed. */
  flush: () => void;
  /** Forget pending work but allow future requests. */
  cancel: () => void;
  /** Cancel work and permanently ignore future requests. */
  dispose: () => void;
  /** Read-only counters used by tests and focused diagnostics. */
  state: () => Readonly<{ pending: boolean; scheduled: boolean; disposed: boolean }>;
};

function browserTimers(): TimerHost {
  return {
    now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
  };
}

export function createRateLimitedTask(
  task: () => void,
  intervalMs = 100,
  timers: TimerHost = browserTimers()
): RateLimitedTask {
  if (!Number.isFinite(intervalMs) || intervalMs < 0) {
    throw new RangeError(`intervalMs must be a finite non-negative number; received ${intervalMs}`);
  }

  let lastRunAt = Number.NEGATIVE_INFINITY;
  let timer: unknown | null = null;
  let pending = false;
  let disposed = false;

  const clearTimer = () => {
    if (timer === null) return;
    timers.clearTimeout(timer);
    timer = null;
  };

  const runPending = () => {
    clearTimer();
    if (!pending || disposed) return;
    pending = false;
    lastRunAt = timers.now();
    task();
  };

  const request = () => {
    if (disposed) return;
    pending = true;
    if (timer !== null) return;

    const remaining = intervalMs - (timers.now() - lastRunAt);
    if (remaining <= 0) {
      runPending();
      return;
    }
    timer = timers.setTimeout(runPending, remaining);
  };

  const cancel = () => {
    pending = false;
    clearTimer();
  };

  return {
    request,
    flush: () => {
      if (disposed || !pending) return;
      runPending();
    },
    cancel,
    dispose: () => {
      if (disposed) return;
      cancel();
      disposed = true;
    },
    state: () => Object.freeze({ pending, scheduled: timer !== null, disposed }),
  };
}
