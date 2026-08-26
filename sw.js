// СВЕМА LAB :: Service Worker
// Нужен ТОЛЬКО для того, чтобы браузер (Chrome/Edge/Android) считал сайт
// "устанавливаемым" и показал нативный промпт (событие beforeinstallprompt).
// Заодно даёт офлайн-работу приложения после первого визита.
//
// Важно: Service Worker регистрируется только по HTTPS или на localhost.
// На file:// (открытие index.html двойным кликом) он не активируется —
// это ограничение браузеров, а не баг. Смотри README в архиве.

const CACHE_NAME = 'svema-lab-v5'; // бампать при каждом деплое новой версии
const APP_SHELL = [
  './index.html',
  './assets/app.js',
  './assets/crop.js',
  './assets/raw.js',
  './assets/data/film-data.js',
  './assets/engine/masks.js',
  './assets/engine/filmResponse.js',
  './assets/engine/developer.js',
  './assets/engine/pushpull.js',
  './assets/engine/grain.js',
  './assets/engine/uniformity.js',
  './assets/engine/halationBloom.js',
  './assets/engine/defects.js',
  './assets/engine/core.js',
  './assets/styles/base.css',
  './assets/styles/layout.css',
  './assets/styles/components.css',
  './assets/styles/modules.css',
  './assets/manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first для app shell, сеть — для остального (с фолбэком в кеш при офлайне).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
