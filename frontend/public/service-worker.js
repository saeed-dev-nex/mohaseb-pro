const CACHE_NAME = 'mohaseb-pro-shell-v3.1.0';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/fonts/vazirmatn-1.woff2', '/fonts/vazirmatn-2.woff2', '/fonts/vazirmatn-3.woff2'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const isNavigation = request.mode === 'navigate';
  const isBuildAsset = new URL(request.url).pathname.startsWith('/assets/');
  event.respondWith(fetch(request).then(async (response) => {
    const contentType = response.headers.get('content-type') || '';
    // Vite's SPA fallback may return index.html with HTTP 200 for a missing JS chunk.
    // Never cache or serve that HTML as a module or stylesheet.
    if (isBuildAsset && contentType.includes('text/html')) {
      return new Response('Build asset not found', { status: 404, statusText: 'Not Found' });
    }
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (isNavigation) return (await caches.match('/index.html')) || Response.error();
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }));
});
