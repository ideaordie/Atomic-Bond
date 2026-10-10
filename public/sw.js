/* Deliberately no runtime data cache, request logging or background mutation. */
// Refresh the existing public-only assets for the theme-aware offline page.
const CACHE = "atomic-bond-public-v3";
const OFFLINE = "/offline.html";
const ASSETS = [
  OFFLINE,
  "/design-tokens.css",
  "/appearance-init.js",
  "/icons/atom-192.png",
  "/icons/atom-512.png",
  "/icons/atom-maskable-512.png",
  "/icons/apple-touch-icon.png",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const path of ASSETS) {
        const response = await fetch(path, {
          credentials: "omit",
          cache: "reload",
        });
        if (!response.ok || response.redirected)
          throw new Error("Offline assets unavailable");
        await cache.put(path, response);
      }
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("atomic-bond-public-") && key !== CACHE)
          await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        async () =>
          (await caches.match(OFFLINE)) ||
          new Response("You're offline. Reconnect and try again.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          }),
      ),
    );
    return;
  }
  if (!url.search && ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(url.pathname).then((cached) => cached || fetch(request)),
    );
  }
});
