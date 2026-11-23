const CACHE_NAME = 'photolens-shell-v1';
const APP_BASE = new URL('./', self.registration.scope);
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE_NAME);
  const indexUrl = new URL('./index.html', APP_BASE);
  try {
    const response = await fetch(indexUrl);
    if (response.ok) {
      await cache.put(indexUrl, response.clone());
      const html = await response.text();
      const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
      for (const ref of [...refs, './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png']) {
        const asset = new URL(ref, indexUrl);
        if (asset.origin === self.location.origin) {
          try { const assetResponse = await fetch(asset); if (assetResponse.ok) await cache.put(asset, assetResponse); } catch { /* Asset will be cached on first use. */ }
        }
      }
    }
  } catch { /* First installation requires a network visit. */ }
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('photolens-') && key !== CACHE_NAME) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match(new URL('./index.html', APP_BASE)));
      }
    })());
    return;
  }
  if (url.pathname.includes('/assets/') || url.pathname.endsWith('/manifest.webmanifest') || url.pathname.endsWith('/icon.svg')) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') (await caches.open(CACHE_NAME)).put(request, response.clone());
      return response;
    })());
  }
});
