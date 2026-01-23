const CACHE_NAME = 'ritual-v3-cache-v1';
const OFFLINE_URL = '/v3/index.html';

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/v3/styles.css',
  '/v3/main.js',
  '/v3/router.js',
  '/v3/today.js',
  '/v3/calendar.js',
  '/v3/score.js',
  '/v3/settings.js',
  '/v3/templates.js',
  '/v3/store.js',
  '/v3/images/background-main.png',
  '/v3/images/icon/icon-192.png',
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
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ✅ Fetch
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(res => {
        return res || caches.match(OFFLINE_URL);
      })
    )
  );
});
