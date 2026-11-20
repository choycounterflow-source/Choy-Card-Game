// Choy Card Game — Lightweight Installable PWA Service Worker (v3)
// Safe for both live preview and production: never blocks Vite modules, APIs, or WebSockets.
const CACHE_NAME = 'choy-card-game-shell-v3';
const ICON_ASSETS = [
  '/choy-face-192.png?v=3',
  '/choy-face-512.png?v=3',
  '/choy-face-maskable-512.png?v=3',
  '/choy-face-apple-180.png?v=3',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ICON_ASSETS).catch(() => {}))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve(true)))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API calls, WebSockets, or Vite dev module streams
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/ws') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // Network-first pass-through with icon cache & friendly offline fallback for navigations
  event.respondWith(
    fetch(req).catch(async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      if (req.mode === 'navigate') {
        return new Response(
          `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Choy Card Game</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#031c16;color:#ecfdf5;font-family:system-ui,sans-serif;text-align:center;padding:24px}button{margin-top:16px;background:#fbbf24;color:#022c22;border:0;border-radius:12px;padding:12px 24px;font-weight:800;font-size:15px}</style></head><body><div><h2>Choy Card Game</h2><p>You appear to be offline. Reconnect to continue playing.</p><button onclick="location.reload()">Retry</button></div></body></html>`,
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      return new Response('', { status: 503 });
    })
  );
});
