const CACHE_NAME = 'ritual-v3-cache-v1';
const OFFLINE_URL = '/v3/index.html';

const PRECACHE_ASSETS = [
  '/v3/',
  OFFLINE_URL,

  // Core JS
  '/v3/main.js',
  '/v3/today.js',
  '/v3/calendar.js',
  '/v3/score.js',
  '/v3/settings.js',
  '/v3/templates.js',
  '/v3/store.js',

  // Assets
  '/v3/images/background-main.png',
  '/v3/images/icon/icon-192.png',

  // PWA
  '/v3/manifest.webmanifest'
];

// ✅ Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// ✅ Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ✅ Fetch (network-first, offline fallback)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(res => {
          return res || caches.match(OFFLINE_URL);
        });
      })
  );
});
