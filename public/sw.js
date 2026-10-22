/*
 * EMS Guardian offline service worker.
 * - App shell + built assets: cache-first after first load (Vite hashes filenames).
 * - MediaPipe hand-tracking runtime: precached so ASL works with no connection.
 * - /api/*: always network; never cached (may carry PHI, and AI needs connectivity).
 * Bump VERSION to invalidate old caches on deploy.
 */
const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const PRECACHE = [
  "/",
  "/index.html",
  "/mediapipe/hands/hands.js",
  "/mediapipe/hands/hands.binarypb",
  "/mediapipe/hands/hand_landmark_full.tflite",
  "/mediapipe/hands/hands_solution_packed_assets.data",
  "/mediapipe/hands/hands_solution_packed_assets_loader.js",
  "/mediapipe/hands/hands_solution_simd_wasm_bin.js",
  "/mediapipe/hands/hands_solution_simd_wasm_bin.wasm",
  "/mediapipe/hands/hands_solution_simd_wasm_bin.data",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      // Cache what we can; one missing optional asset must not block install.
      Promise.allSettled(PRECACHE.map((url) => cache.add(url))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/health") return;

  // Page navigations: network first so updates land, cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  // Static assets: cache first, then network (and remember it).
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
