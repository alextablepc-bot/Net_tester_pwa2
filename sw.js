// sw.js — v5-offline
const CACHE_NAME = 'net-scope-v5-offline';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/sites-critical.json',
  '/sites-popular.json',
  '/sites-rkn-blocked.json',
  '/manifest.json',
  '/favicon.ico',
  '/pwa-192x192.png',
  '/pwa-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS).catch(err => {
        console.warn('Не все ресурсы закэшированы:', err);
        // Даже если часть не закэшировалась — всё равно активируем
        return cache.addAll(['/']);
      }).then(() => self.skipWaiting());
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME && key.startsWith('net-scope-')) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // HTML — сначала кэш, потом сеть, fallback на index.html
  if (event.request.destination === 'document') {
    event.respondWith(
      caches.match('/index.html').then(cached => {
        if (cached) return cached;
        return fetch(event.request).catch(() => caches.match('/index.html'));
      })
    );
    return;
  }

  // Все остальные ресурсы
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        // Для JSON — пустой массив
        if (event.request.url.endsWith('.json')) {
          return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
        }
        // Для всего остального — index.html или favicon
        if (event.request.url.endsWith('.ico')) {
          return caches.match('/favicon.ico');
        }
        return caches.match('/index.html');
      });
    })
  );
});