/* Offline support for the portfolio (no build dependency).
 *
 *  - _next/static, fonts, icons, gltfs : cache-first, capped to 128 entries
 *  - images                            : cache-first, capped to 60 entries
 *  - page navigations                  : network-first, capped to 20 entries
 *  - manifest.webmanifest              : network-first, stored with page shell
 *
 * The worker derives its base path from the scope it was registered with. A
 * GitHub Pages project site such as `/repo/` therefore never reads or writes
 * the root site's cache keys. Core page URLs use the export's canonical
 * trailing-slash form (`/offline/`), and static resources live in the same
 * cache bucket that handles their fetches.
 *
 * `build:static` replaces VERSION with a digest of the exported files and the
 * worker source. Do not hand-bump it for content changes. A new worker waits
 * until the old page clients are gone, keeping their hashed chunks available
 * until no old document can request them.
 */
const VERSION = "v6";
const BASE = new URL(self.registration.scope).pathname.replace(/\/+$/, "");
const at = (pathname) => `${BASE}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
const CACHE_SCOPE = encodeURIComponent(BASE || "/");
const STATIC_CACHE_PREFIX = `pf-static-${CACHE_SCOPE}-`;
const MEDIA_CACHE_PREFIX = `pf-media-${CACHE_SCOPE}-`;
const PAGES_CACHE_PREFIX = `pf-pages-${CACHE_SCOPE}-`;
const STATIC = `${STATIC_CACHE_PREFIX}${VERSION}`;
const MEDIA = `${MEDIA_CACHE_PREFIX}${VERSION}`;
const PAGES = `${PAGES_CACHE_PREFIX}${VERSION}`;

const STATIC_MAX_ENTRIES = 128;
const MEDIA_MAX_ENTRIES = 60;
const PAGES_MAX_ENTRIES = 20;
const PAGE_CORE = [at("/"), at("/offline/"), at("/manifest.webmanifest")];
const STATIC_CORE = [at("/icons/icon-192.png")];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      precache(PAGES, PAGE_CORE),
      precache(STATIC, STATIC_CORE),
    ])
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const owned = keys.filter((key) =>
          key.startsWith(STATIC_CACHE_PREFIX) ||
          key.startsWith(MEDIA_CACHE_PREFIX) ||
          key.startsWith(PAGES_CACHE_PREFIX)
        );
        const current = new Set([STATIC, MEDIA, PAGES]);
        const stale = owned.filter((key) => !current.has(key));
        return Promise.all(stale.map((key) => caches.delete(key)));
      })
  );
});

const STATIC_PREFIXES = ["/_next/static/", "/fonts/", "/icons/", "/gltfs/"];
const isMediaAsset = (url) =>
  url.pathname === at("/_next/image") || url.pathname.startsWith(at("/images/"));
const isStaticAsset = (url) => STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(at(prefix)));

function maxEntries(cacheName) {
  if (cacheName === MEDIA) return MEDIA_MAX_ENTRIES;
  if (cacheName === PAGES) return PAGES_MAX_ENTRIES;
  return STATIC_MAX_ENTRIES;
}

function protectedUrls(cacheName) {
  if (cacheName === PAGES) return PAGE_CORE;
  if (cacheName === STATIC) return STATIC_CORE;
  return [];
}

/**
 * Keep the oldest non-core entries out of a cache once its budget is reached.
 * Cache.keys() is insertion ordered; this is a small FIFO bound, not an LRU
 * database. A failed eviction is non-fatal to the successful network response.
 */
async function trimCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  let excess = keys.length - maxEntries(cacheName);
  if (excess <= 0) return;

  const core = new Set(protectedUrls(cacheName).map((url) => new URL(url, self.location.origin).href));
  for (const request of keys) {
    if (excess <= 0) break;
    if (core.has(request.url)) continue;
    if (await cache.delete(request)) excess -= 1;
  }
}

async function store(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  await trimCache(cacheName);
}

/**
 * Cache only direct, successful responses. In particular, `redirect: "error"`
 * makes a bad precache URL fail loudly rather than storing a redirected
 * response that cannot be returned to a navigation request in offline mode.
 */
async function precache(cacheName, urls) {
  await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(url, { redirect: "error" });
      if (!response.ok || response.redirected) throw new Error(`Precache refused ${url}`);
      await store(cacheName, url, response.clone());
    })
  );
}

async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(request);
    if (hit) return hit;
  } catch {
    // Storage may be unavailable; still give the network a chance.
  }

  const response = await fetch(request);
  if (response.ok && !response.redirected) {
    try {
      await store(cacheName, request, response.clone());
    } catch {
      // A quota or eviction error must not hide the successful fetch.
    }
  }
  return response;
}

async function networkFirst(request, cacheName, fallbackUrl) {
  let cache;
  try {
    cache = await caches.open(cacheName);
  } catch {
    // The page can still load online even when Cache Storage is unavailable.
  }

  let response;
  try {
    response = await fetch(request);
  } catch {
    const hit = await cache?.match(request).catch(() => undefined);
    if (hit) return hit;
    if (fallbackUrl) {
      const fallback = await cache?.match(fallbackUrl).catch(() => undefined);
      if (fallback) return fallback;
    }
    return offlineResponse();
  }

  if (response.ok && !response.redirected) {
    try {
      await store(cacheName, request, response.clone());
    } catch {
      // Do not replace a successful network response with a cache error.
    }
  }
  return response;
}

/**
 * Return a clean basic response when an older cache contains a response that
 * was fetched through a redirect. Fetch forbids a redirected cached response
 * from satisfying a navigation request whose redirect mode is `manual`.
 */
function cleanNavigationResponse(response) {
  if (!response) return null;
  if (!response.redirected) return response;
  try {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch {
    return null;
  }
}

function offlineResponse() {
  return new Response("Offline", {
    status: 503,
    statusText: "Offline",
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

/** Race a navigation with a short deadline, but never cancel the fetch. */
function withTimeout(promise, delay) {
  let timer = 0;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(undefined), delay);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * How long a navigation waits for the network before an available cached page
 * or offline shell is used. The fetch stays alive so a slow connection can
 * refresh the cache for the next visit.
 */
const NAV_TIMEOUT = 4000;

function navigationFirst(request, fallbackUrl) {
  const background = fetch(request)
    .then(async (response) => {
      if (response.ok && !response.redirected) {
        try {
          await store(PAGES, request, response.clone());
        } catch {
          // Keep serving the response even when storage or eviction fails.
        }
      }
      return response;
    })
    .catch(() => undefined);

  const response = (async () => {
    const cached = cleanNavigationResponse(await caches.open(PAGES)
      .then((cache) => cache.match(request))
      .catch(() => undefined));
    const fresh = await withTimeout(background, NAV_TIMEOUT);
    if (fresh) return fresh;
    if (cached) return cached;
    const fallback = cleanNavigationResponse(await caches.open(PAGES)
      .then((cache) => cache.match(fallbackUrl))
      .catch(() => undefined));
    return fallback || offlineResponse();
  })();

  return { response, background };
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isMediaAsset(url)) {
    event.respondWith(cacheFirst(request, MEDIA).catch(() => new Response("", { status: 504 })));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC).catch(() => new Response("", { status: 504 })));
    return;
  }
  if (request.mode === "navigate") {
    const navigation = navigationFirst(request, at("/offline/"));
    event.respondWith(navigation.response);
    // The network may outlive the response deadline; keep the worker alive so
    // its successful response can still refresh the page cache.
    event.waitUntil(navigation.background);
    return;
  }
  if (url.pathname === at("/manifest.webmanifest")) {
    event.respondWith(networkFirst(request, PAGES));
  }
});
