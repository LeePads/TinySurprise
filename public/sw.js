const CACHE_PREFIX = "tinysurprise-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-v11`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-v11`;
const ACTIVE_CACHES = new Set([SHELL_CACHE, RUNTIME_CACHE]);
const MAX_RUNTIME_ENTRIES = 72;
const CODE_DESTINATIONS = new Set(["script", "style", "worker"]);

function isCodeRequest(request) {
  return CODE_DESTINATIONS.has(request.destination) ||
    new URL(request.url).pathname.startsWith("/_next/static/");
}

function canStoreResponse(request, response) {
  if (!response.ok || request.headers.has("range") || request.cache === "no-store") return false;
  const control = response.headers.get("Cache-Control") || "";
  if (/(?:^|,)\s*(?:no-store|private)\b/i.test(control)) return false;
  // Next development/HMR assets must never become offline cache entries.
  // Production content-hashed chunks explicitly advertise immutability.
  return !isCodeRequest(request) ||
    (!/(?:^|,)\s*no-cache\b/i.test(control) && /(?:^|,)\s*immutable\b/i.test(control));
}

async function matchActiveCache(request) {
  // Prefer a page fetched during use over its install-time shell snapshot.
  for (const cacheName of [RUNTIME_CACHE, SHELL_CACHE]) {
    const response = await caches.match(request, { cacheName });
    if (response && canStoreResponse(request, response)) return response;
  }
}
const CORE = [
  "/",
  "/templates",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/favicon-64.png",
  "/icons/tiny-surprise-app-light-1024.png",
  "/icons/tiny-surprise-app-dark-1024.png",
  "/icons/tiny-surprise-pwa-maskable-light-512.png",
  "/icons/tiny-surprise-wordmark-light-2048w.png",
  "/icons/tiny-surprise-wordmark-dark-2048w.png",
  "/art/hero.jpg",
  "/hearts/heart_1.png",
  "/hearts/heart_drawing.png",
  "/hearts/heart_pixel.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(
        CORE.map(async (url) => {
          const request = new Request(url, { cache: "reload" });
          const response = await fetch(request);
          if (canStoreResponse(request, response)) await cache.put(request, response);
        }),
      );
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) => key.startsWith(CACHE_PREFIX) && !ACTIVE_CACHES.has(key),
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function trimRuntimeCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  const overflow = keys.length - MAX_RUNTIME_ENTRIES;
  if (overflow <= 0) return;
  await Promise.all(keys.slice(0, overflow).map((key) => cache.delete(key)));
}

async function cacheRuntimeResponse(request, response) {
  if (!canStoreResponse(request, response)) return;
  const cacheCopy = response.clone();
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, cacheCopy);
  await trimRuntimeCache();
}

async function networkFirst(request, navigation, event) {
  try {
    const response = await fetch(new Request(request, { cache: "no-cache" }));
    event.waitUntil(cacheRuntimeResponse(request, response).catch(() => undefined));
    return response;
  } catch {
    const cached = await matchActiveCache(request);
    if (cached) return cached;
    if (navigation) {
      return (await matchActiveCache(new Request(new URL("/offline.html", self.location.origin)))) || Response.error();
    }
    return Response.error();
  }
}

async function cacheFirst(request, event) {
  const cached = await matchActiveCache(request);
  // Revalidate mutable/no-cache resources while online. Offline fallback may
  // use stored public resources, but never development scripts or no-store data.
  if (cached && !["reload", "no-cache", "no-store"].includes(request.cache) &&
      !/(?:^|,)\s*no-cache\b/i.test(cached.headers.get("Cache-Control") || "")) return cached;
  return networkFirst(request, false, event);
}

self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  ) {
    return;
  }

  const destination = event.request.destination;
  const navigation = event.request.mode === "navigate";

  if (navigation) {
    event.respondWith(networkFirst(event.request, true, event));
    return;
  }

  if (
    !event.request.headers.has("range") &&
    (destination === "script" ||
      destination === "style" ||
      destination === "worker" ||
      destination === "font" ||
      destination === "image" ||
      destination === "audio")
  ) {
    event.respondWith(cacheFirst(event.request, event));
  }
});
