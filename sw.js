/* Chromatic — service worker
   Strategy
     navigations        network-first, falls back to the cached shell (offline)
     same-origin assets cache-first, revalidated in the background
     Google Fonts CSS   stale-while-revalidate
     Google Fonts files cache-first, immutable
   Bump VERSION on every deploy — it renames the caches and evicts the old ones. */

const VERSION = 'v1.0.0';
const SHELL = `chromatic-shell-${VERSION}`;
const RUNTIME = `chromatic-runtime-${VERSION}`;
const FONTS = `chromatic-fonts-${VERSION}`;
const KEEP = new Set([SHELL, RUNTIME, FONTS]);

const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './icons/favicon-32.png',
  './icons/favicon-64.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // addAll is atomic — one 404 loses the whole precache, so add individually.
    await Promise.all(SHELL_URLS.map(async url => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (err) {
        console.warn('[sw] precache skipped', url, err);
      }
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map(n => (KEEP.has(n) ? null : caches.delete(n))));
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

const isFontCss = url => url.origin === 'https://fonts.googleapis.com';
const isFontFile = url => url.origin === 'https://fonts.gstatic.com';

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await network) || Response.error();
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never touch camera/media or blob/data traffic.
  if (url.protocol === 'blob:' || url.protocol === 'data:') return;

  // 1. Page navigations — network-first so a deploy lands immediately.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        const res = preload || (await fetch(request));
        const cache = await caches.open(SHELL);
        cache.put('./index.html', res.clone());
        return res;
      } catch {
        const cache = await caches.open(SHELL);
        return (await cache.match('./index.html')) || (await cache.match('./')) ||
          new Response('<h1>Offline</h1><p>Open Chromatic once while online to install it for offline use.</p>',
            { headers: { 'Content-Type': 'text/html' } });
      }
    })());
    return;
  }

  // 2. Google Fonts.
  if (isFontFile(url)) { event.respondWith(cacheFirst(request, FONTS)); return; }
  if (isFontCss(url))  { event.respondWith(staleWhileRevalidate(request, FONTS)); return; }

  // 3. Same-origin assets.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
  }
});
