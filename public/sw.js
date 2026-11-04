/**
 * EMS Guardian demo service worker — runtime cache-first shell with network
 * fallback. Registered ONLY by demo builds (see the demo-pwa-html plugin in
 * vite.config.ts); production deployments ship no service worker.
 *
 * Plain ES, no build step, no dependencies.
 */
const CACHE_NAME = 'ems-guardian-demo-v1';

// Cross-origin assets cached for offline use after first load.
const MODEL_ASSET_RE = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\//i; // MediaPipe hands model (ASL)
const TILE_RE = /^https:\/\/([a-d]\.)?tile\.openstreetmap\.org\//i; // map tiles (OSM + subdomains)

// AI endpoints are dynamic and carry the caller's API key — never cached.
function isAiEndpoint(url) {
  return (
    url.hostname === 'generativelanguage.googleapis.com' ||
    url.hostname === 'api.elevenlabs.io'
  );
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isAiEndpoint(url)) return;

  const cacheable =
    url.origin === self.location.origin ||
    request.mode === 'navigate' ||
    MODEL_ASSET_RE.test(request.url) ||
    TILE_RE.test(request.url);
  if (!cacheable) return;

  event.respondWith(cacheFirst(request));
});

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>U1 Field — Offline</title><style>body{background:#070B12;color:#22c55e;font-family:monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}p{border:1px solid #1f2937;padding:16px;font-size:12px;letter-spacing:.2em;text-transform:uppercase}</style></head><body><p>Offline — open once online to cache the demo shell.</p></body></html>`;

/**
 * Cache-first with network fallback: any GET the SW sees for a cacheable
 * target is served from the runtime cache when present, otherwise fetched and
 * stored for the next offline use (opaque responses from models/tiles included).
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      // Best-effort write; a failed cache entry only costs an offline replay.
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    if (request.mode === 'navigate') {
      const shell = (await cache.match('/index.html', { ignoreVary: true })) || (await cache.match('/', { ignoreVary: true }));
      if (shell) return shell;
      return new Response(OFFLINE_HTML, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    // Nothing cached and the network is down: surface the failure instead of
    // answering with a fake success.
    throw error;
  }
}
