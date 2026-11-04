/* Blockspell service worker. Generated into dist/sw.js by scripts/pwa-plugin.mjs at build time:
 * The two placeholders below get a hash of the build and the list of every file in dist/.
 * Cache-first, so once the first visit has finished the whole game runs with no network at all. */
const VERSION = '__VERSION__';
const CACHE = 'blockspell-' + VERSION;
const FILES = __FILES__;
const scope = self.registration.scope;
const urlOf = (f) => new URL(f, scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(urlOf(f), { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('blockspell-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  else if (event.data === 'VERSION') event.source?.postMessage({ type: 'version', version: VERSION, files: FILES.length });
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // page loads always get the cached shell (any query string: ?level=2, ?hd=1 ...)
      const hit = req.mode === 'navigate' ? await cache.match(urlOf('./index.html'), { ignoreVary: true }) : await cache.match(req, { ignoreVary: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      } catch (err) {
        const fallback = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
        if (fallback) return fallback;
        throw err;
      }
    })(),
  );
});
