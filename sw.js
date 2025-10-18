// sw.js
const APP_VERSION = '2025-04-05'; // ← меняйте при обновлении
const CACHE_NAME = 'net-scope-' + APP_VERSION;

const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './sites-critical.json',
  './sites-popular.json',
  './sites-rkn-blocked.json',
  './manifest.json',
  './favicon.ico',
  './pwa-192x192.png',
  './pwa-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS).catch(err => {
        console.warn('Partial cache failure:', err);
        return cache.addAll(['./']); // хотя бы index.html
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
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.destination === 'document') {
    event.respondWith(
      caches.match('./').then(cached => cached || fetch(event.request).catch(() => caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => {
        if (event.request.url.endsWith('.json')) {
          return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
        }
        return caches.match('./');
      });
    })
  );
});