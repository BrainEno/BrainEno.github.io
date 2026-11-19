#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { marqueeBoostFromVelocity } from "../src/portfolio/scroll/marquee-speed.ts";
import { createRateLimitedTask } from "../src/portfolio/scroll/pointer-sync.ts";
import { createRevealMemory } from "../src/portfolio/scroll/reveal-memory.ts";
import { sectionFromHash } from "../src/portfolio/scroll/hash-section.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHOREOGRAPHY = readFileSync(path.join(ROOT, "src/portfolio/scroll/choreography.ts"), "utf8");
const REVEALS = readFileSync(path.join(ROOT, "src/portfolio/scroll/reveals.ts"), "utf8");
const PORTFOLIO = readFileSync(path.join(ROOT, "src/portfolio/ui/Portfolio.tsx"), "utf8");

class ManualTimers {
  nowValue = 0;
  nextId = 0;
  entries = new Map();

  now = () => this.nowValue;

  setTimeout = (callback, delay) => {
    const id = ++this.nextId;
    this.entries.set(id, { callback, at: this.nowValue + delay });
    return id;
  };

  clearTimeout = (id) => {
    this.entries.delete(id);
  };

  advance(milliseconds) {
    const targetTime = this.nowValue + milliseconds;
    while (true) {
      const due = [...this.entries.entries()]
        .filter(([, entry]) => entry.at <= targetTime)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      const [id, entry] = due;
      this.entries.delete(id);
      this.nowValue = entry.at;
      entry.callback();
    }
    this.nowValue = targetTime;
  }
}

const timerHost = (clock) => ({ now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });

test("rate-limited pointer sync runs immediately, then at most once per interval", () => {
  const clock = new ManualTimers();
  const calls = [];
  const sync = createRateLimitedTask(() => calls.push(clock.now()), 100, timerHost(clock));

  sync.request();
  assert.deepEqual(calls, [0]);
  sync.request();
  sync.request();
  sync.request();
  assert.equal(calls.length, 1);
  assert.equal(sync.state().pending, true);
  assert.equal(sync.state().scheduled, true);

  clock.advance(99);
  assert.equal(calls.length, 1);
  clock.advance(1);
  assert.deepEqual(calls, [0, 100]);
  assert.equal(sync.state().pending, false);
  assert.equal(sync.state().scheduled, false);
});

test("a trailing pointer sync uses the latest state requested during the burst", () => {
  const clock = new ManualTimers();
  let latestTarget = "row-a";
  const calls = [];
  const sync = createRateLimitedTask(() => calls.push(latestTarget), 80, timerHost(clock));

  sync.request();
  latestTarget = "row-b";
  sync.request();
  latestTarget = "row-c";
  sync.request();
  clock.advance(80);
  assert.deepEqual(calls, ["row-a", "row-c"]);
});

test("flush runs pending work now and clears its timer", () => {
  const clock = new ManualTimers();
  const calls = [];
  const sync = createRateLimitedTask(() => calls.push(clock.now()), 120, timerHost(clock));
  sync.request();
  sync.request();
  clock.advance(20);
  sync.flush();

  assert.deepEqual(calls, [0, 20]);
  assert.equal(clock.entries.size, 0);
  assert.equal(sync.state().pending, false);
});

test("cancel clears pending work but permits a later request", () => {
  const clock = new ManualTimers();
  const calls = [];
  const sync = createRateLimitedTask(() => calls.push(clock.now()), 100, timerHost(clock));
  sync.request();
  sync.request();
  sync.cancel();
  clock.advance(200);
  assert.deepEqual(calls, [0]);
  assert.equal(sync.state().scheduled, false);

  sync.request();
  assert.deepEqual(calls, [0, 200]);
});

test("dispose cancels timers and permanently ignores new requests", () => {
  const clock = new ManualTimers();
  const calls = [];
  const sync = createRateLimitedTask(() => calls.push(clock.now()), 100, timerHost(clock));
  sync.request();
  sync.request();
  sync.dispose();
  sync.request();
  clock.advance(500);

  assert.deepEqual(calls, [0]);
  assert.equal(clock.entries.size, 0);
  assert.deepEqual(sync.state(), { pending: false, scheduled: false, disposed: true });
});

test("invalid pointer-sync intervals fail early", () => {
  const clock = new ManualTimers();
  assert.throws(() => createRateLimitedTask(() => {}, -1, timerHost(clock)), RangeError);
  assert.throws(() => createRateLimitedTask(() => {}, Number.NaN, timerHost(clock)), RangeError);
});

test("marquee speed boost is symmetric, finite and capped", () => {
  assert.equal(marqueeBoostFromVelocity(0), 1);
  assert.equal(marqueeBoostFromVelocity(320), 2);
  assert.equal(marqueeBoostFromVelocity(-320), 2);
  assert.equal(marqueeBoostFromVelocity(1_600), 6);
  assert.equal(marqueeBoostFromVelocity(100_000), 6);
  assert.equal(marqueeBoostFromVelocity(Number.NaN), 1);
  assert.equal(marqueeBoostFromVelocity(Number.POSITIVE_INFINITY), 1);
});

test("portfolio hash parsing accepts only known sections", () => {
  assert.equal(sectionFromHash("#intro"), "intro");
  assert.equal(sectionFromHash("#works"), "works");
  assert.equal(sectionFromHash("#contact"), "contact");
  assert.equal(sectionFromHash(""), null);
  assert.equal(sectionFromHash("#admin"), null);
  assert.equal(sectionFromHash("#works?x=1"), null);
});

test("hash navigation waits for loader readiness and uses refreshed smoother geometry", () => {
  assert.match(PORTFOLIO, /window\.addEventListener\("hashchange", onHashChange\)/);
  assert.match(PORTFOLIO, /if \(loadStatus !== "ready" \|\| !target\) return/);
  assert.match(PORTFOLIO, /ScrollTrigger\.refresh\(\);[\s\S]{0,260}scrollToSection\(target\)/);
  assert.match(PORTFOLIO, /navigation\?\.type === "back_forward"/);
});

test("reveal memory records terminal states without retaining detached elements", () => {
  const memory = createRevealMemory();
  const element = {};
  const detachedElement = {};

  assert.equal(memory.hasCompleted(element), false);
  memory.complete(element);
  memory.complete(detachedElement);
  assert.equal(memory.hasCompleted(element), true);
  assert.equal(memory.hasCompleted(detachedElement), true);
  memory.reset(element);
  assert.equal(memory.hasCompleted(element), false);
  assert.equal(memory.hasCompleted(detachedElement), true);
});

test("one-shot reveal contexts survive language and resize choreography rebuilds", () => {
  assert.match(PORTFOLIO, /import \{ setupReveals \} from "\.\.\/scroll\/reveals"/);
  assert.match(PORTFOLIO, /return setupReveals\(scope\);\s*\}, \[\]\);/);
  assert.match(PORTFOLIO, /const teardown = setupChoreography\(\{[\s\S]*?\}, \[layoutLanguage, layoutKey, preview\]\);/);
  assert.match(REVEALS, /const memory = createRevealMemory\(\)/);
  assert.match(REVEALS, /animation\.progress\(1, true\)/);
  assert.match(REVEALS, /animation\.eventCallback\("onReverseComplete", \(\) => memory\.reset\(identity\)\)/);
  assert.doesNotMatch(CHOREOGRAPHY, /gsap\.from\(row\.querySelector\("\.work-row-line"\)/);
});

test("scroll-driven pointer sync is rate-limited and disabled outside the rows phase", () => {
  assert.match(CHOREOGRAPHY, /const scrollPointerSync = hoverCapable\s*\? createRateLimitedTask/);
  assert.match(CHOREOGRAPHY, /createRateLimitedTask\([\s\S]{0,180}if \(phase === "rows"\) opts\.syncPointer\?\.\(\)[\s\S]{0,80}, 100\)/);
  assert.match(CHOREOGRAPHY, /if \(hoverCapable && phase === "rows"\) scrollPointerSync\?\.request\(\)/);
  assert.match(CHOREOGRAPHY, /scrollPointerSync\?\.dispose\(\)/);
  assert.match(CHOREOGRAPHY, /scrollPointerSync\?\.cancel\(\)/);
});

test("marquee onUpdate retargets reusable tweens instead of allocating frame-by-frame", () => {
  const from = CHOREOGRAPHY.indexOf("// Endless counter-running bands");
  const to = CHOREOGRAPHY.indexOf("function sectionTracking", from);
  assert.ok(from >= 0 && to > from, "contact marquee block should be present");
  const marquee = CHOREOGRAPHY.slice(from, to);

  assert.match(marquee, /const speedTweens = loops\.map/);
  assert.match(marquee, /accelerate: gsap\.to\(loop, \{[^}]*paused: true/);
  assert.match(marquee, /recover: gsap\.to\(loop, \{[^}]*paused: true/);
  assert.match(marquee, /onUpdate: \(self\) => accelerateToVelocity\(self\.getVelocity\(\)\)/);
  assert.match(marquee, /ScrollTrigger\.addEventListener\("scrollEnd", recoverToRestingSpeed\)/);
  assert.match(marquee, /ScrollTrigger\.removeEventListener\("scrollEnd", recoverToRestingSpeed\)/);
  assert.doesNotMatch(marquee, /gsap\.to\(loop,\s*\{\s*timeScale:\s*boost/);
});
