#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { computeStaticRevision, injectWorkerVersion } from "./service-worker-build.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = readFileSync(resolve(ROOT, "public/sw.js"), "utf8");
const VERSION = "v6";

function serviceWorkerHarness({
  scope = "https://braineno.example/repo/",
  fetchResource = async (url) => new Response(`network:${new URL(url).pathname}`),
} = {}) {
  const origin = new URL(scope).origin;
  const listeners = new Map();
  const records = new Map();
  const fetchCalls = [];
  const timers = new Map();
  let timerSequence = 0;
  let failCacheWrites = false;
  let waitingWasSkipped = false;
  let clientsWereClaimed = false;

  const absolute = (input) => new URL(typeof input === "string" ? input : input.url, origin).href;
  const cloneResponse = (response) => {
    const clone = response.clone();
    if (response.redirected) {
      Object.defineProperty(clone, "redirected", { value: true, configurable: true });
    }
    return clone;
  };

  class MemoryCache {
    constructor(name) {
      this.name = name;
      if (!records.has(name)) records.set(name, new Map());
      this.entries = records.get(name);
    }

    async match(request) {
      const response = this.entries.get(absolute(request));
      return response ? cloneResponse(response) : undefined;
    }

    async put(request, response) {
      if (failCacheWrites) throw new Error("simulated Cache Storage quota failure");
      this.entries.set(absolute(request), cloneResponse(response));
    }

    async keys() {
      return [...this.entries.keys()].map((url) => ({ url }));
    }

    async delete(request) {
      return this.entries.delete(absolute(request));
    }
  }

  const caches = {
    async open(name) {
      return new MemoryCache(name);
    },
    async keys() {
      return [...records.keys()];
    },
    async delete(name) {
      return records.delete(name);
    },
  };

  const setTimeoutMock = (callback, delay) => {
    const id = ++timerSequence;
    timers.set(id, { callback, delay });
    return id;
  };
  const clearTimeoutMock = (id) => timers.delete(id);

  const self = {
    registration: { scope },
    location: new URL(scope),
    clients: {
      async claim() {
        clientsWereClaimed = true;
      },
    },
    async skipWaiting() {
      waitingWasSkipped = true;
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  };

  const fetchMock = async (request, options = {}) => {
    const url = absolute(request);
    fetchCalls.push({ url, options });
    return fetchResource(url, options, request);
  };

  vm.runInNewContext(SOURCE, {
    self,
    caches,
    fetch: fetchMock,
    URL,
    Response,
    Promise,
    setTimeout: setTimeoutMock,
    clearTimeout: clearTimeoutMock,
    console,
  }, { filename: "public/sw.js" });

  function dispatchLifecycle(type) {
    const pending = [];
    listeners.get(type)?.({ waitUntil: (promise) => pending.push(Promise.resolve(promise)) });
    return Promise.all(pending);
  }

  function dispatchFetch(request) {
    const pending = [];
    let response;
    listeners.get("fetch")?.({
      request,
      respondWith(value) {
        response = Promise.resolve(value);
      },
      waitUntil(value) {
        pending.push(Promise.resolve(value));
      },
    });
    return { response, pending };
  }

  function request(url, { method = "GET", mode = "navigate", headers = {} } = {}) {
    const normalizedHeaders = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
    return {
      url: absolute(url),
      method,
      mode,
      headers: { has: (name) => normalizedHeaders.has(name.toLowerCase()) },
    };
  }

  function fireTimers() {
    const queued = [...timers.values()];
    timers.clear();
    for (const timer of queued) timer.callback();
  }

  function cacheNames() {
    return [...records.keys()];
  }

  return {
    absolute,
    caches,
    dispatchFetch,
    dispatchLifecycle,
    fetchCalls,
    fireTimers,
    setFailCacheWrites: (value) => {
      failCacheWrites = value;
    },
    records,
    request,
    cacheNames,
    get waitingWasSkipped() {
      return waitingWasSkipped;
    },
    get clientsWereClaimed() {
      return clientsWereClaimed;
    },
    get pendingTimerCount() {
      return timers.size;
    },
  };
}

const scopeKey = (base) => encodeURIComponent(base || "/");
const staticCache = (base) => `pf-static-${scopeKey(base)}-${VERSION}`;
const mediaCache = (base) => `pf-media-${scopeKey(base)}-${VERSION}`;
const pagesCache = (base) => `pf-pages-${scopeKey(base)}-${VERSION}`;
const makeRedirected = (body, status = 200) => {
  const response = new Response(body, { status, headers: { "content-type": "text/html" } });
  Object.defineProperty(response, "redirected", { value: true, configurable: true });
  return response;
};

async function install(worker) {
  await worker.dispatchLifecycle("install");
}

async function responseText(promise) {
  assert.ok(promise, "request should be intercepted with respondWith");
  const response = await promise;
  return { response, text: await response.text() };
}

test("install precaches canonical pages and the icon in their fetch-time buckets", async () => {
  const worker = serviceWorkerHarness();
  await install(worker);

  const requestedPaths = worker.fetchCalls.map(({ url }) => new URL(url).pathname).sort();
  assert.deepEqual(requestedPaths, [
    "/repo/",
    "/repo/icons/icon-192.png",
    "/repo/manifest.webmanifest",
    "/repo/offline/",
  ]);
  assert.ok(worker.fetchCalls.every(({ options }) => options.redirect === "error"));
  assert.equal(worker.waitingWasSkipped, false, "an updated worker must wait for old documents to close");

  const pages = worker.records.get(pagesCache("/repo"));
  const assets = worker.records.get(staticCache("/repo"));
  assert.ok(pages.has("https://braineno.example/repo/"));
  assert.ok(pages.has("https://braineno.example/repo/offline/"));
  assert.ok(pages.has("https://braineno.example/repo/manifest.webmanifest"));
  assert.equal(pages.has("https://braineno.example/repo/icons/icon-192.png"), false);
  assert.ok(assets.has("https://braineno.example/repo/icons/icon-192.png"));
});

test("root-scope installations keep root paths and use a distinct cache namespace", async () => {
  const worker = serviceWorkerHarness({ scope: "https://braineno.example/" });
  await install(worker);
  const paths = worker.fetchCalls.map(({ url }) => new URL(url).pathname).sort();
  assert.deepEqual(paths, ["/", "/icons/icon-192.png", "/manifest.webmanifest", "/offline/"]);
  assert.ok(worker.cacheNames().includes(staticCache("")));
  assert.ok(worker.cacheNames().includes(pagesCache("")));
  assert.notEqual(staticCache(""), staticCache("/repo"));
});

test("export content produces a stable automatic revision without recursive version hashing", () => {
  const baseFiles = [
    { path: "index.html", content: "<main>one</main>" },
    { path: "sitemap.xml", content: "<lastmod>2026-11-11</lastmod>" },
    { path: "sw.js", content: SOURCE },
  ];
  const revision = computeStaticRevision(baseFiles);
  const injected = injectWorkerVersion(SOURCE, revision);

  assert.ok(injected.includes(`const VERSION = "build-${revision}";`));
  assert.equal(computeStaticRevision(baseFiles), revision);
  assert.equal(computeStaticRevision([
    ...baseFiles.filter((file) => file.path !== "sitemap.xml"),
    { path: "sitemap.xml", content: "<lastmod>2026-11-12</lastmod>" },
  ]), revision, "build-time sitemap timestamps must not invalidate application caches");
  assert.equal(computeStaticRevision([
    { path: "index.html", content: "<main>two</main>" },
    { path: "sw.js", content: SOURCE },
  ]) === revision, false, "changed export bytes must produce a new cache namespace");
  assert.equal(computeStaticRevision([
    { path: "index.html", content: "<main>one</main>" },
    { path: "sw.js", content: injected },
  ]), revision, "injected VERSION must not recursively alter the digest");
});

test("media cache stays within its 60-entry budget and keeps the newest images", async () => {
  const worker = serviceWorkerHarness();
  await install(worker);
  for (let index = 0; index < 65; index += 1) {
    const event = worker.dispatchFetch(worker.request(`/repo/images/upload-${index}.webp`, { mode: "cors" }));
    await responseText(event.response);
  }

  const images = worker.records.get(mediaCache("/repo"));
  assert.equal(images.size, 60);
  assert.equal(images.has("https://braineno.example/repo/images/upload-0.webp"), false);
  assert.equal(images.has("https://braineno.example/repo/images/upload-64.webp"), true);
});

test("page cache stays within 20 entries while preserving the offline core", async () => {
  const worker = serviceWorkerHarness();
  await install(worker);
  for (let index = 0; index < 24; index += 1) {
    const event = worker.dispatchFetch(worker.request(`/repo/works/${index}/`));
    await responseText(event.response);
    await Promise.all(event.pending);
  }

  const pages = worker.records.get(pagesCache("/repo"));
  assert.equal(pages.size, 20);
  assert.ok(pages.has("https://braineno.example/repo/"));
  assert.ok(pages.has("https://braineno.example/repo/offline/"));
  assert.ok(pages.has("https://braineno.example/repo/manifest.webmanifest"));
  assert.equal(pages.has("https://braineno.example/repo/works/0/"), false);
});

test("the pre-cached icon is served from the static cache without a network round trip", async () => {
  const worker = serviceWorkerHarness();
  await install(worker);
  const callsBefore = worker.fetchCalls.length;
  const event = worker.dispatchFetch(worker.request("/repo/icons/icon-192.png", { mode: "cors" }));
  const { response, text } = await responseText(event.response);

  assert.equal(response.status, 200);
  assert.equal(text, "network:/repo/icons/icon-192.png");
  assert.equal(worker.fetchCalls.length, callsBefore);
  assert.equal(event.pending.length, 0);
});

test("an uncached offline navigation returns the canonical offline shell", async () => {
  const worker = serviceWorkerHarness();
  await install(worker);
  const callsBefore = worker.fetchCalls.length;
  // Existing core pages remain available; only the request under test goes offline.
  const original = worker.fetchCalls;
  assert.ok(original.length > 0);

  // The harness fetch handler is scoped at creation, so use a separate worker
  // to model an offline load after a successful installation.
  const offline = serviceWorkerHarness({
    fetchResource: async (url) => {
      if (new URL(url).pathname.endsWith("/offline/")) return new Response("offline shell");
      if (new URL(url).pathname === "/repo/" || new URL(url).pathname.endsWith("/manifest.webmanifest") || new URL(url).pathname.endsWith("/icon-192.png")) {
        return new Response(`cached:${new URL(url).pathname}`);
      }
      throw new TypeError("offline");
    },
  });
  await install(offline);
  const event = offline.dispatchFetch(offline.request("/repo/works/uncached/"));
  const { response, text } = await responseText(event.response);
  await Promise.all(event.pending);

  assert.equal(response.status, 200);
  assert.equal(text, "offline shell");
  assert.ok(offline.fetchCalls.length > callsBefore);
});

test("redirected cached navigation and fallback responses are reconstructed as basic responses", async () => {
  const worker = serviceWorkerHarness({
    fetchResource: async (url) => {
      if (new URL(url).pathname === "/repo/") return new Response("home");
      if (new URL(url).pathname.endsWith("/offline/")) return new Response("offline shell");
      if (new URL(url).pathname.endsWith("/manifest.webmanifest")) return new Response("{}");
      if (new URL(url).pathname.endsWith("/icon-192.png")) return new Response("icon");
      throw new TypeError("offline");
    },
  });
  await install(worker);
  const pages = await worker.caches.open(pagesCache("/repo"));
  await pages.put("/repo/offline/", makeRedirected("redirected fallback"));
  await pages.put("/repo/works/old/", makeRedirected("redirected cached page"));

  const fallbackEvent = worker.dispatchFetch(worker.request("/repo/works/new/"));
  const fallback = await responseText(fallbackEvent.response);
  assert.equal(fallback.response.status, 200);
  assert.equal(fallback.response.redirected, false);
  assert.equal(fallback.text, "redirected fallback");

  const cachedEvent = worker.dispatchFetch(worker.request("/repo/works/old/"));
  const cached = await responseText(cachedEvent.response);
  assert.equal(cached.response.redirected, false);
  assert.equal(cached.text, "redirected cached page");
});

test("activation deletes stale caches only in this worker's scope namespace", async () => {
  const worker = serviceWorkerHarness();
  const names = [
    staticCache("/repo").replace(VERSION, "v5"),
    mediaCache("/repo").replace(VERSION, "v5"),
    pagesCache("/repo").replace(VERSION, "v5"),
    staticCache("/other").replace(VERSION, "v5"),
    mediaCache("/other").replace(VERSION, "v5"),
    "unrelated-cache",
  ];
  for (const name of names) await worker.caches.open(name);
  await worker.dispatchLifecycle("activate");

  assert.deepEqual(worker.cacheNames().sort(), [
    staticCache("/other").replace(VERSION, "v5"),
    mediaCache("/other").replace(VERSION, "v5"),
    "unrelated-cache",
  ].sort());
  assert.equal(worker.clientsWereClaimed, false, "activate must not claim old documents mid-session");
});

test("a slow navigation falls back by its deadline and leaves the cache-refresh fetch alive", async () => {
  let resolveNetwork;
  const worker = serviceWorkerHarness({
    fetchResource: (url) => {
      if (new URL(url).pathname === "/repo/works/slow/") {
        return new Promise((resolve) => {
          resolveNetwork = resolve;
        });
      }
      if (new URL(url).pathname === "/repo/") return new Response("home");
      if (new URL(url).pathname.endsWith("/offline/")) return new Response("offline shell");
      if (new URL(url).pathname.endsWith("/manifest.webmanifest")) return new Response("{}");
      return new Response("icon");
    },
  });
  await install(worker);
  const cache = await worker.caches.open(pagesCache("/repo"));
  await cache.put("/repo/works/slow/", new Response("cached slow page"));

  const event = worker.dispatchFetch(worker.request("/repo/works/slow/"));
  // Give the navigation coroutine a chance to open the cache and install its deadline timer.
  for (let i = 0; i < 8 && worker.pendingTimerCount === 0; i += 1) await Promise.resolve();
  assert.equal(worker.pendingTimerCount, 1);
  assert.equal(event.pending.length, 1, "the network refresh is attached to waitUntil");

  worker.fireTimers();
  const { response, text } = await responseText(event.response);
  assert.equal(response.status, 200);
  assert.equal(text, "cached slow page");
  assert.equal(typeof resolveNetwork, "function", "the slow network request was not cancelled");
  assert.equal(worker.pendingTimerCount, 0, "the deadline timer is cleared after the race");

  resolveNetwork(new Response("fresh slow page"));
  await Promise.all(event.pending);
  const refreshed = await cache.match("/repo/works/slow/");
  assert.equal(await refreshed.text(), "fresh slow page");
});

test("successful navigations are returned and stored for a later offline visit", async () => {
  const worker = serviceWorkerHarness();
  await install(worker);
  const event = worker.dispatchFetch(worker.request("/repo/works/fresh/"));
  const { response, text } = await responseText(event.response);
  await Promise.all(event.pending);

  assert.equal(response.status, 200);
  assert.equal(text, "network:/repo/works/fresh/");
  const cache = await worker.caches.open(pagesCache("/repo"));
  assert.equal(await (await cache.match("/repo/works/fresh/")).text(), text);
  assert.equal(worker.pendingTimerCount, 0);
});

test("Cache Storage quota errors never hide successful network responses", async () => {
  const worker = serviceWorkerHarness();
  await install(worker);
  worker.setFailCacheWrites(true);

  const imageEvent = worker.dispatchFetch(worker.request("/repo/images/live.webp", { mode: "cors" }));
  const image = await responseText(imageEvent.response);
  assert.equal(image.response.status, 200);
  assert.equal(image.text, "network:/repo/images/live.webp");

  const manifestEvent = worker.dispatchFetch(worker.request("/repo/manifest.webmanifest", { mode: "cors" }));
  const manifest = await responseText(manifestEvent.response);
  assert.equal(manifest.response.status, 200);
  assert.equal(manifest.text, "network:/repo/manifest.webmanifest");

  const pageEvent = worker.dispatchFetch(worker.request("/repo/works/fresh/"));
  const page = await responseText(pageEvent.response);
  await Promise.all(pageEvent.pending);
  assert.equal(page.response.status, 200);
  assert.equal(page.text, "network:/repo/works/fresh/");
});

test("non-GET, range and cross-origin requests are left to the browser", () => {
  const worker = serviceWorkerHarness();
  const post = worker.dispatchFetch(worker.request("/repo/submit/", { method: "POST" }));
  const range = worker.dispatchFetch(worker.request("/repo/videos/clip.mp4", { headers: { Range: "bytes=0-99" } }));
  const external = worker.dispatchFetch(worker.request("https://cdn.example/image.webp", { mode: "cors" }));
  assert.equal(post.response, undefined);
  assert.equal(range.response, undefined);
  assert.equal(external.response, undefined);
});
