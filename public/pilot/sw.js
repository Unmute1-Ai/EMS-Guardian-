/* Guardian EMS communication pilot: offline shell.
   Precaches the page so it opens with no signal after the first visit.
   Network-first for the page itself so a new build replaces the old one when online. */
const CACHE = 'gems-pilot-0.1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('gems-pilot-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      const hit = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
      if (hit) return hit;
      throw err;
    }
  })());
});
