// СВЕМА LAB :: Service Worker
// Нужен ТОЛЬКО для того, чтобы браузер (Chrome/Edge/Android) считал сайт
// "устанавливаемым" и показал нативный промпт (событие beforeinstallprompt).
// Заодно даёт офлайн-работу приложения после первого визита.
//
// Важно: Service Worker регистрируется только по HTTPS или на localhost.
// На file:// (открытие index.html двойным кликом) он не активируется —
// это ограничение браузеров, а не баг. Смотри README в архиве.

const CACHE_NAME = 'svema-lab-v11'; // бампать при каждом деплое новой версии
const APP_SHELL = [
  './index.html',
  './assets/app.js',
  './assets/crop.js',
  './assets/raw.js',
  './assets/pwa.js',
  './assets/histogram.js',
  './assets/data/film-data.js',
  './assets/engine/masks.js',
  './assets/engine/filmResponse.js',
  './assets/engine/developer.js',
  './assets/engine/pushpull.js',
  './assets/engine/grain.js',
  // acutance.js раньше отсутствовал в списке: при офлайне/после установки
  // модуль не кешировался, FilmEngine.Acutance оказывался undefined и рендер
  // падал на первом же кадре (core.js вызывает FilmEngine.Acutance.render).
  './assets/engine/acutance.js',
  './assets/engine/uniformity.js',
  './assets/engine/halationBloom.js',
  './assets/engine/noise.js',
  './assets/engine/defects.js',
  './assets/engine/core.js',
  './assets/styles/base.css',
  './assets/styles/layout.css',
  './assets/styles/components.css',
  './assets/styles/modules.css',
  './assets/styles/landing-index.css',
  './assets/styles/editor-theme.css',
  './assets/manifest.json',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // addAll падает целиком, если хоть один файл не отдался (404) — тогда
      // service worker вообще не установится и останется висеть старая версия.
      // Поэтому кешируем по одному и игнорируем отдельные неудачи.
      .then((cache) => Promise.all(
        APP_SHELL.map((url) => cache.add(url).catch(() => null))
      ))
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

// HTML (навигация) — сначала сеть, кеш только как офлайн-фолбэк. Иначе
// cache-first на index.html навсегда оставлял у пользователя старую версию
// разметки, и новые скрипты к ней уже не подходили.
// Остальное (стили/скрипты/иконки) — cache-first, как и раньше.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // внешние ссылки не трогаем

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
