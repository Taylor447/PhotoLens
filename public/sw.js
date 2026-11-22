const CACHE_NAME = 'photolens-shell-v3';
const APP_SCOPE = new URL(self.registration.scope);

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('photolens-') && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== APP_SCOPE.origin || !url.pathname.startsWith(APP_SCOPE.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
        return response;
      } catch {
        return (await caches.match(request)) ||
          (await caches.match(new URL('index.html', APP_SCOPE)));
      }
    })());
    return;
  }

  const isAppAsset = url.pathname.includes('/assets/') ||
    /\.(?:js|css|svg|png|webp|woff2?|webmanifest)$/i.test(url.pathname);
  if (!isAppAsset) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        (await caches.open(CACHE_NAME)).put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw new Error('PhotoLens đang ngoại tuyến và tài nguyên này chưa được lưu.');
    }
  })());
});
