
const CACHE_NAME = 'voice-inventory-v3';
const PRECACHE_URLS = [
  './',
  './index.html',
  './index.css',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/2897/2897785.png',
  'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
            return response;
          }

          // Cache external resources (CDN) dynamically
          // Include huggingface models if possible (though they are large and handled by transformers.js cache usually)
          // transformers.js manages its own cache, but we cache script files here.
          if (url.protocol.startsWith('http')) {
             const responseToCache = response.clone();
             caches.open(CACHE_NAME)
               .then(cache => {
                 cache.put(event.request, responseToCache);
               });
          }

          return response;
        }).catch(() => {
           // Offline fallback logic
        });
      })
  );
});