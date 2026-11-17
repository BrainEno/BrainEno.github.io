#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";
import { motionPolicy } from "../src/portfolio/scroll/motion-policy.ts";
import { boothSpinRate, shouldPauseBooth } from "../src/portfolio/three/booth-visibility.ts";
import {
  channelKey,
  containsPoint,
  createTransitionEpoch,
  isPlaybackRequestReady,
  ownsPlaybackResult,
  videoControlCopy,
} from "../src/portfolio/ui/tv-transition.ts";

const policyFlags = [
  "scrollTransforms",
  "sectionPins",
  "channelEffects",
  "autoplayPreview",
  "theaterCamera",
  "ambientLoops",
];

test("full-motion policy keeps the authored presentation", () => {
  const policy = motionPolicy(false);
  assert.equal(policy.smoothScroll, 1.1);
  for (const key of policyFlags) assert.equal(policy[key], true, `${key} should be enabled`);
});

test("reduced-motion policy disables every automatic movement channel", () => {
  const policy = motionPolicy(true);
  assert.equal(policy.smoothScroll, 0);
  for (const key of policyFlags) assert.equal(policy[key], false, `${key} should be disabled`);
  assert.equal(Object.isFrozen(policy), true, "a matchMedia context cannot mutate its policy");
});

test("policy instances are stable immutable mode values", () => {
  assert.equal(motionPolicy(true), motionPolicy(true));
  assert.equal(motionPolicy(false), motionPolicy(false));
  assert.notEqual(motionPolicy(true), motionPolicy(false));
  assert.throws(() => {
    motionPolicy(true).sectionPins = true;
  }, TypeError);
});

test("telephone booth renders only while both viewport and document are visible", () => {
  assert.equal(shouldPauseBooth(false, false), true);
  assert.equal(shouldPauseBooth(false, true), true);
  assert.equal(shouldPauseBooth(true, false), true);
  assert.equal(shouldPauseBooth(true, true), false);
});

test("telephone booth idle rotation follows live reduced-motion policy", () => {
  assert.equal(boothSpinRate(true, 0.16), 0);
  assert.equal(boothSpinRate(false, 0.16), 0.16);
  assert.equal(boothSpinRate(false, 0), 0);
});

test("rapid A → B → A retuning only permits the final A callback", () => {
  const epoch = createTransitionEpoch();
  const committed = [];
  const commit = (token, id) => {
    if (epoch.isCurrent(token)) committed.push(id);
  };

  const firstA = epoch.next();
  const pendingB = epoch.next();
  const finalA = epoch.next();
  commit(pendingB, "B (stale delayed commit)");
  commit(firstA, "A (stale entrance commit)");
  commit(finalA, "A (latest request)");

  assert.deepEqual(committed, ["A (latest request)"]);
});

test("rapid A → B → C retuning rejects both obsolete channels", () => {
  const epoch = createTransitionEpoch();
  const committed = [];
  const commit = (token, id) => {
    if (epoch.isCurrent(token)) committed.push(id);
  };
  const a = epoch.next();
  const b = epoch.next();
  const c = epoch.next();
  commit(a, "A");
  commit(b, "B");
  commit(c, "C");
  assert.deepEqual(committed, ["C"]);
});

test("an unmount invalidates callbacks even if their promises resolve later", () => {
  const epoch = createTransitionEpoch();
  const token = epoch.next();
  epoch.invalidate();
  assert.equal(epoch.isCurrent(token), false);
  assert.equal(epoch.current(), token + 1);
});

test("beginning a new request always advances the generation", () => {
  const epoch = createTransitionEpoch();
  const one = epoch.next();
  const two = epoch.next();
  const three = epoch.next();
  assert.ok(one < two && two < three);
  assert.equal(epoch.isCurrent(three), true);
});

test("channel keys distinguish idle, active and changed work", () => {
  assert.equal(channelKey(null, false), channelKey(null, false));
  assert.notEqual(channelKey(null, false), channelKey("a", true));
  assert.notEqual(channelKey("a", true), channelKey("b", true));
  assert.notEqual(channelKey("a", true), channelKey("a", false));
});

test("CRT hit testing includes top/left and excludes bezel bottom/right", () => {
  const bounds = { left: 10, top: 20, right: 110, bottom: 70 };
  assert.equal(containsPoint(bounds, 10, 20), true);
  assert.equal(containsPoint(bounds, 109.99, 69.99), true);
  assert.equal(containsPoint(bounds, 110, 40), false);
  assert.equal(containsPoint(bounds, 40, 70), false);
  assert.equal(containsPoint(bounds, 9.99, 40), false);
  assert.equal(containsPoint(bounds, 40, 19.99), false);
});

test("CRT hit testing rejects non-finite pointer coordinates", () => {
  const bounds = { left: 0, top: 0, right: 100, bottom: 100 };
  assert.equal(containsPoint(bounds, Number.NaN, 50), false);
  assert.equal(containsPoint(bounds, 50, Number.NaN), false);
  assert.equal(containsPoint(bounds, Number.POSITIVE_INFINITY, 50), false);
  assert.equal(containsPoint(bounds, 50, Number.NEGATIVE_INFINITY), false);
});

test("English playback copy names the project and the current action", () => {
  assert.deepEqual(videoControlCopy("en", "paused", "Demo Film"), {
    label: "Play Demo Film video",
    announcement: "Demo Film, paused",
  });
  assert.deepEqual(videoControlCopy("en", "playing", "Demo Film"), {
    label: "Pause Demo Film video",
    announcement: "Demo Film, playing",
  });
});

test("Chinese playback copy names the project and the current action", () => {
  assert.deepEqual(videoControlCopy("zh", "paused", "演示影片"), {
    label: "播放演示影片视频",
    announcement: "演示影片，已暂停",
  });
  assert.deepEqual(videoControlCopy("zh", "playing", "演示影片"), {
    label: "暂停演示影片视频",
    announcement: "演示影片，正在播放",
  });
});

test("blocked autoplay asks for an explicit keyboard or pointer action", () => {
  const english = videoControlCopy("en", "blocked", "Demo Film");
  const chinese = videoControlCopy("zh", "blocked", "演示影片");
  assert.match(english.announcement, /Enter or Space/);
  assert.match(chinese.announcement, /Enter 或空格键/);
  assert.match(english.label, /Play Demo Film/);
  assert.match(chinese.label, /播放演示影片/);
});

test("unavailable video reports the still-image fallback", () => {
  const english = videoControlCopy("en", "unavailable", "Demo Film");
  const chinese = videoControlCopy("zh", "unavailable", "演示影片");
  assert.match(english.label, /unavailable/);
  assert.match(english.announcement, /still preview/);
  assert.match(chinese.label, /暂不可用/);
  assert.match(chinese.announcement, /静态预览/);
});

test("a stale play promise cannot publish its previous channel state", async () => {
  const epoch = createTransitionEpoch();
  const first = epoch.next();
  let resolvePlay;
  const oldPlay = new Promise((resolve) => {
    resolvePlay = resolve;
  });
  const state = { channel: "A", playing: false };
  const guardedPlay = oldPlay.then(() => {
    if (!epoch.isCurrent(first)) return;
    state.playing = true;
  });

  state.channel = "B";
  epoch.next();
  resolvePlay();
  await guardedPlay;
  assert.deepEqual(state, { channel: "B", playing: false });
});

test("latest play result may update state while its channel remains current", async () => {
  const epoch = createTransitionEpoch();
  const token = epoch.next();
  let resolvePlay;
  const play = new Promise((resolve) => {
    resolvePlay = resolve;
  });
  const state = { playing: false };
  const guarded = play.then(() => {
    if (epoch.isCurrent(token)) state.playing = true;
  });
  resolvePlay();
  await guarded;
  assert.deepEqual(state, { playing: true });
});

test("row playback waits until the requested work is both active and painted", () => {
  const request = { workId: "film-a", action: "play", sequence: 1 };
  assert.equal(isPlaybackRequestReady(request, "film-a", null, false), false);
  assert.equal(isPlaybackRequestReady(request, "film-a", "film-b", true), false);
  assert.equal(isPlaybackRequestReady(request, "film-b", "film-b", true), false);
  assert.equal(isPlaybackRequestReady(request, "film-a", "film-a", true), true);
});

test("a late play promise is invalidated by either a retune or a later pause", () => {
  const channels = createTransitionEpoch();
  const playback = createTransitionEpoch();
  const channelToken = channels.next();
  const playToken = playback.next();
  assert.equal(ownsPlaybackResult(channels, channelToken, playback, playToken), true);

  playback.next();
  assert.equal(ownsPlaybackResult(channels, channelToken, playback, playToken), false);

  const latestChannel = channels.next();
  const latestPlay = playback.next();
  assert.equal(ownsPlaybackResult(channels, latestChannel, playback, latestPlay), true);
  channels.next();
  assert.equal(ownsPlaybackResult(channels, latestChannel, playback, latestPlay), false);
});
