// sw.js
const APP_VERSION = '2025-10-20.1'; // Обнови при изменениях в статике
const CACHE_NAME = 'net-scope-' + APP_VERSION;

const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './favicon.ico',
  './pwa-192x192.png',
  './pwa-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS).catch(err => {
        console.warn('Partial cache failure (core assets only):', err);
        return cache.addAll(['./']); // кэшируем хотя бы index.html
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
            console.log('Deleting old cache:', key);
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
        // Для JSON-файлов возвращаем пустой массив, если нет сети
        if (event.request.url.includes('.json')) {
          return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
        }
        // Для остальных — кэшированный ресурс (если есть), иначе ошибка
        return caches.match(event.request);
      });
    })
  );
});