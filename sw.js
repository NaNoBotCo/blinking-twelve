/* blinky1200 service worker.
   - The HTML page is network-FIRST, so deployed updates always reach players
     (falls back to cache when offline).
   - Static assets (icons, card) are cache-first for speed + offline.
   - Leaderboard API calls are never touched. */
const CACHE = "blinky1200-v2";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (/\/(scores|start|finish)\b/.test(url.pathname)) return; // never cache the leaderboard API

  const isDoc = e.request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html");
  if (isDoc) {
    // network-first: always try the live page, fall back to cache offline
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy));
        return res;
      }).catch(() => caches.match(e.request).then((h) => h || caches.match("./index.html")))
    );
    return;
  }
  // assets: cache-first, then network (and cache it)
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && url.origin === location.origin) { const c = res.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); }
      return res;
    }).catch(() => hit))
  );
});
